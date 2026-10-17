export interface ServerCpu {
  cpuNum: number;
  used: number;
  sys: number;
  wait: number;
  free: number;
}

export interface ServerMem {
  total: number;
  used: number;
  free: number;
  usage: number;
}

export interface ServerJvm {
  total: number;
  max: number;
  used: number;
  free: number;
  usage: number;
  name: string;
  version: string;
  startTime: string;
  runTime: string;
}

export interface ServerSys {
  osName: string;
  osArch: string;
}

export interface ServerSysFile {
  dirName: string;
  sysTypeName: string;
  typeName: string;
  total: string;
  free: string;
  used: string;
  usage: number;
}

export interface ServerMonitorVO {
  cpu: ServerCpu;
  mem: ServerMem;
  jvm: ServerJvm;
  sys: ServerSys;
  sysFiles: ServerSysFile[];
}
