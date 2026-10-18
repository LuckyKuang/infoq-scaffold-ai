package cc.infoq.common.utils;

import cn.hutool.core.lang.tree.Tree;
import cn.hutool.core.lang.tree.parser.NodeParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class TreeBuildUtilsTest {

    @Test
    @DisplayName("build/getLeafNodes: should build hierarchy and extract leaf nodes")
    void buildAndLeafNodesShouldWork() {
        List<NodeData> nodes = List.of(
            new NodeData(1L, 0L, "root"),
            new NodeData(2L, 1L, "child-a"),
            new NodeData(3L, 1L, "child-b")
        );

        List<Tree<Long>> trees = TreeBuildUtils.build(nodes, parser());
        List<Tree<Long>> leaves = TreeBuildUtils.getLeafNodes(trees);
        List<Long> leafIds = leaves.stream().map(Tree::getId).collect(Collectors.toList());

        assertEquals(1, trees.size());
        assertEquals(2, leaves.size());
        assertTrue(leafIds.containsAll(List.of(2L, 3L)));
    }

    @Test
    @DisplayName("buildMultiRoot/build(parentId): should support explicit parent and multi root")
    void buildWithParentAndMultiRootShouldWork() {
        List<NodeData> nodes = List.of(
            new NodeData(1L, 0L, "root-a"),
            new NodeData(2L, 1L, "a-child"),
            new NodeData(3L, -1L, "root-b"),
            new NodeData(4L, 3L, "b-child")
        );

        List<Tree<Long>> explicitParent = TreeBuildUtils.build(nodes, 0L, parser());
        List<Tree<Long>> multiRoot = TreeBuildUtils.buildMultiRoot(nodes, NodeData::getId, NodeData::getParentId, parser());

        assertEquals(1, explicitParent.size());
        assertEquals(2, multiRoot.size());
    }

    @Test
    @DisplayName("build/getLeafNodes: should return empty list for empty input")
    void buildShouldReturnEmptyForEmptyInput() {
        assertTrue(TreeBuildUtils.build(List.<NodeData>of(), parser()).isEmpty());
        assertTrue(TreeBuildUtils.build(List.<NodeData>of(), 0L, parser()).isEmpty());
        assertTrue(TreeBuildUtils.buildMultiRoot(List.<NodeData>of(), NodeData::getId, NodeData::getParentId, parser()).isEmpty());
        assertTrue(TreeBuildUtils.getLeafNodes(List.<Tree<Long>>of()).isEmpty());
    }

    private static NodeParser<NodeData, Long> parser() {
        return (node, tree) -> {
            tree.setId(node.getId());
            tree.setParentId(node.getParentId());
            tree.setName(node.getName());
        };
    }

    private static final class NodeData {
        private final Long id;
        private final Long parentId;
        private final String name;

        private NodeData(Long id, Long parentId, String name) {
            this.id = id;
            this.parentId = parentId;
            this.name = name;
        }

        private Long getId() {
            return id;
        }

        private Long getParentId() {
            return parentId;
        }

        private String getName() {
            return name;
        }
    }
}
