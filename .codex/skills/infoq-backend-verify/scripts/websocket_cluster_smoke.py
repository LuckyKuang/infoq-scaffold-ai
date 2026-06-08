#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
import signal
import subprocess
import sys
import time

import redis
import websockets

WEB_SOCKET_TOPIC = "global:websocket"


def parse_args():
    parser = argparse.ArgumentParser(description="Run two-node websocket cluster smoke verification.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port-a", type=int, default=19081)
    parser.add_argument("--port-b", type=int, default=19082)
    parser.add_argument("--node-id-a", default="node-a")
    parser.add_argument("--node-id-b", default="node-b")
    parser.add_argument("--websocket-path", default="/resource/websocket")
    parser.add_argument("--server-b-pid", type=int, required=True)
    parser.add_argument("--user-settle-seconds", type=float, default=1.5)
    parser.add_argument("--user-clear-timeout-seconds", type=float, default=15.0)
    parser.add_argument("--cleanup-timeout-seconds", type=float, default=140.0)
    parser.add_argument("--skip-abnormal-exit", action="store_true")
    return parser.parse_args()


def require_env(name):
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"missing required environment variable: {name}")
    return value


def decode_member(value):
    if value is None:
        return None
    try:
        return json.loads(value)
    except Exception:
        return value


def build_redis_client():
    return redis.Redis(
        host=require_env("CLUSTER_SMOKE_REDIS_HOST"),
        port=int(require_env("CLUSTER_SMOKE_REDIS_PORT")),
        db=int(require_env("CLUSTER_SMOKE_REDIS_DB")),
        password=require_env("CLUSTER_SMOKE_REDIS_PASSWORD"),
        decode_responses=True,
    )


def kill_process_tree(pid: int):
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    os.kill(pid, signal.SIGKILL)


def state_snapshot(client, user_id, node_id_a, node_id_b):
    keys = {
        "heartbeat_a": f"{WEB_SOCKET_TOPIC}:node:heartbeat:{node_id_a}",
        "heartbeat_b": f"{WEB_SOCKET_TOPIC}:node:heartbeat:{node_id_b}",
        "node_users_a": f"{WEB_SOCKET_TOPIC}:node:users:{node_id_a}",
        "node_users_b": f"{WEB_SOCKET_TOPIC}:node:users:{node_id_b}",
        "user_nodes": f"{WEB_SOCKET_TOPIC}:user:nodes:{user_id}",
    }
    return {
        "heartbeat_a_exists": bool(client.exists(keys["heartbeat_a"])),
        "heartbeat_b_exists": bool(client.exists(keys["heartbeat_b"])),
        "heartbeat_b_pttl": client.pttl(keys["heartbeat_b"]),
        "node_users_a": sorted(str(decode_member(x)) for x in client.smembers(keys["node_users_a"])),
        "node_users_b": sorted(str(decode_member(x)) for x in client.smembers(keys["node_users_b"])),
        "user_nodes": sorted(str(decode_member(x)) for x in client.smembers(keys["user_nodes"])),
    }


async def wait_for_user_clear(client, user_id, node_id_a, node_id_b, timeout_seconds):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        snap = state_snapshot(client, user_id, node_id_a, node_id_b)
        if not snap["node_users_a"] and not snap["node_users_b"] and not snap["user_nodes"]:
            print("USER_ROUTE_CLEARED=" + json.dumps(snap, ensure_ascii=False, sort_keys=True))
            return
        await asyncio.sleep(0.5)
    raise RuntimeError("user routing state did not clear after graceful disconnect")


async def wait_for_stale_cleanup(client, user_id, node_id_a, node_id_b, timeout_seconds):
    start = time.time()
    while time.time() - start <= timeout_seconds:
        snap = state_snapshot(client, user_id, node_id_a, node_id_b)
        payload = {
            "elapsed_s": round(time.time() - start, 1),
            **snap,
        }
        print("CLEANUP_POLL=" + json.dumps(payload, ensure_ascii=False, sort_keys=True))
        if not snap["heartbeat_b_exists"] and not snap["node_users_b"] and not snap["user_nodes"]:
            return payload
        await asyncio.sleep(10)
    raise RuntimeError("stale node cleanup did not converge within timeout")


async def dual_node_routing_phase(args, headers, client, user_id):
    uri_a = f"ws://{args.host}:{args.port_a}{args.websocket_path}"
    uri_b = f"ws://{args.host}:{args.port_b}{args.websocket_path}"
    payload = f"cluster-verify-{int(time.time())}"

    async with websockets.connect(uri_a, additional_headers=headers) as ws_a, websockets.connect(
        uri_b, additional_headers=headers
    ) as ws_b:
        await asyncio.sleep(args.user_settle_seconds)
        snap = state_snapshot(client, user_id, args.node_id_a, args.node_id_b)
        print("ROUTING_SNAPSHOT=" + json.dumps(snap, ensure_ascii=False, sort_keys=True))
        if str(user_id) not in snap["node_users_a"] or str(user_id) not in snap["node_users_b"]:
            raise RuntimeError(f"user registration missing from node sets: {snap}")
        if args.node_id_a not in snap["user_nodes"] or args.node_id_b not in snap["user_nodes"]:
            raise RuntimeError(f"node routing missing from user set: {snap}")

        await ws_a.send(payload)
        recv_a = await asyncio.wait_for(ws_a.recv(), timeout=10)
        recv_b = await asyncio.wait_for(ws_b.recv(), timeout=10)
        print(f"ROUTING_RECV_A={recv_a}")
        print(f"ROUTING_RECV_B={recv_b}")
        if recv_a != payload or recv_b != payload:
            raise RuntimeError(f"unexpected routed messages: recv_a={recv_a}, recv_b={recv_b}, payload={payload}")


async def abnormal_exit_phase(args, headers, client, user_id):
    uri_b = f"ws://{args.host}:{args.port_b}{args.websocket_path}"
    ws_b = await websockets.connect(uri_b, additional_headers=headers)
    try:
        print(f"ABNORMAL_EXIT_CONNECTED=node={args.node_id_b}")
        await asyncio.sleep(args.user_settle_seconds)
        snap = state_snapshot(client, user_id, args.node_id_a, args.node_id_b)
        print("ABNORMAL_EXIT_SNAPSHOT=" + json.dumps(snap, ensure_ascii=False, sort_keys=True))
        if str(user_id) not in snap["node_users_b"] or args.node_id_b not in snap["user_nodes"]:
            raise RuntimeError(f"node-b registration missing before kill -9: {snap}")

        kill_process_tree(args.server_b_pid)
        await asyncio.wait_for(ws_b.wait_closed(), timeout=10)
        print(f"ABNORMAL_EXIT_WS_CLOSED=code={ws_b.close_code}, reason={ws_b.close_reason!r}")

        cleanup_state = await wait_for_stale_cleanup(
            client,
            user_id,
            args.node_id_a,
            args.node_id_b,
            args.cleanup_timeout_seconds,
        )
        print("ABNORMAL_EXIT_CLEANUP=" + json.dumps(cleanup_state, ensure_ascii=False, sort_keys=True))
    finally:
        await ws_b.close()


async def main():
    args = parse_args()
    token = require_env("CLUSTER_SMOKE_TOKEN")
    user_id = require_env("CLUSTER_SMOKE_USER_ID")
    client_id = require_env("CLUSTER_SMOKE_CLIENT_ID")
    client = build_redis_client()
    headers = {
        "Authorization": f"Bearer {token}",
        "clientid": client_id,
    }

    await dual_node_routing_phase(args, headers, client, user_id)
    await wait_for_user_clear(
        client,
        user_id,
        args.node_id_a,
        args.node_id_b,
        args.user_clear_timeout_seconds,
    )
    if not args.skip_abnormal_exit:
        await abnormal_exit_phase(args, headers, client, user_id)

    print("PASS websocket cluster smoke")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        sys.exit(1)
