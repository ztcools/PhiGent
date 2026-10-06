import { useEffect, useRef, useState } from 'react';
import { drag } from 'd3-drag';
import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { select } from 'd3-selection';
import { zoom as d3Zoom } from 'd3-zoom';
import { useTheme } from '@mui/material';
import { cloneObj } from '@/utils';
import { DataExplorerRoot, SelectedNodes } from './StyledComponents';
import DataPanel from './DataPanel';
import type { GraphData, GraphNode, GraphLink } from '../../types';
import type { SearchResultData } from '@server/types';

interface DataExplorerProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
}

// 辅助函数：判断节点是否已存在
function findNodes(nodes: any[], vector: any) {
  return nodes.filter(node => node.id === vector.id);
}

// 辅助函数：判断连线是否已存在
function linkExists(links: any[], source: string, target: string) {
  return links.some(link => link.source === source && link.target === target);
}

// 节点颜色使用的 d3 颜色比例尺
const color = scaleOrdinal(schemeCategory10);

// 把 Milvus 搜索结果格式化为图数据
export const formatMilvusData = (
  graphData: GraphData,
  searchedVector: {
    id: string;
    [key: string]: any;
  },
  results: SearchResultData[]
) => {
  const graphDataCopy = cloneObj(graphData) as GraphData;
  // 若 searchedVector 的 id 为 'root'，color = 0
  // 否则找出 graphDataCopy.nodes 中最大的 color，color = 最大 color + 1
  const color =
    searchedVector.id === 'root'
      ? 0
      : Math.max(...graphDataCopy.nodes.map(node => node.color)) + 1;

  // 搜索向量不存在时，将其作为节点加入
  const existingNodes = findNodes(graphDataCopy.nodes, searchedVector);
  if (!existingNodes.length) {
    graphDataCopy.nodes.push({
      id: searchedVector.id,
      data: searchedVector,
      searchIds: [searchedVector.id],
      color: color,
    });
  } else {
    // 用新数据更新已存在的节点
    existingNodes.forEach(node => {
      if (!node.searchIds.includes(searchedVector.id)) {
        node.searchIds.push(searchedVector.id);
      }
    });
  }

  results.forEach(result => {
    // 结果向量不存在时，将其作为节点加入
    const existingNodes = findNodes(graphDataCopy.nodes, result);
    if (!existingNodes.length) {
      graphDataCopy.nodes.push({
        id: result.id,
        data: result,
        searchIds: [searchedVector.id],
        color: color,
      });
    } else {
      // 用新数据更新已存在的节点
      existingNodes.forEach(node => {
        if (!node.searchIds.includes(searchedVector.id)) {
          node.searchIds.push(searchedVector.id);
        }
      });
    }

    // 搜索向量与结果向量之间没有连线时创建连线
    const sourceId = searchedVector.id;
    const targetId = result.id;
    if (!linkExists(graphDataCopy.links, sourceId, targetId)) {
      graphDataCopy.links.push({
        source: sourceId,
        target: targetId,
        score: result.score,
      });
    }
  });

  // 返回格式化后的图数据
  return graphDataCopy;
};

const DataExplorer = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
}: DataExplorerProps) => {
  // 状态
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  //  用 ref 保存选中的节点，再借助这个 state 触发组件重渲染，从而不影响 d3 的效果
  const [render, setRender] = useState<number>(0);
  // 主题
  const theme = useTheme();

  // ref
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const selectedNodesRef = useRef<any[]>([]);

  // data 变化时，从 selectedNodesRef 中过滤掉已不存在的数据
  useEffect(() => {
    selectedNodesRef.current = selectedNodesRef.current.filter(node =>
      data.nodes.some(n => n.id === node.id)
    );
    setRender(prev => prev + 1);
  }, [JSON.stringify(data)]);

  // d3 副作用
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    // 没有数据时，清空选中节点和悬浮节点
    if (!data.nodes.length) {
      selectedNodesRef.current = [];
      setHoveredNode(null);
    }
    // 状态
    let _isDragging = false;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    // 渲染新数据前先清除之前的节点和连线
    g.selectAll('*').remove(); // 这会移除 <g> 元素的所有子元素

    // 定义缩放行为
    const zoom = d3Zoom()
      .scaleExtent([0.1, 10]) // 限制缩放比例
      .on('zoom', event => {
        // 把变换应用到 g 元素（图所在的位置）
        g.attr('transform', event.transform);
      });

    // 把缩放行为应用到 svg
    svg.call(zoom as any).on('dblclick.zoom', null);

    // 克隆数据，避免修改原始数据
    const links = cloneObj(data.links) as GraphLink[];
    const nodes = cloneObj(data.nodes) as GraphNode[];

    const simulation = forceSimulation(nodes as SimulationNodeDatum[])
      .force(
        'link',
        forceLink(links)
          .id((d: any) => d.id)
          .distance(d => {
            const maxDistance = 150;
            const minDistance = 50;
            return maxDistance - d.score * (maxDistance - minDistance);
          })
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 3, height / 3));

    // 绘制连线
    const link = g
      .selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke-width', 2)
      .attr('stroke', theme.palette.divider);

    // 绘制节点
    const node = g
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', d =>
        selectedNodesRef.current.some(n => n.id === d.id) ? 16 : 8
      )
      .attr('fill', d => {
        return color(d.color + '');
      })
      .attr('cursor', 'pointer')
      .attr('stroke', d =>
        selectedNodesRef.current.some(n => n.id === d.id)
          ? 'black'
          : 'transparent'
      )
      .attr('stroke-width', d =>
        selectedNodesRef.current.some(n => n.id === d.id) ? 2 : 0
      )
      .on('mouseover', (event, d) => {
        // 高亮悬浮的节点，不影响已选中的节点
        // d3.select(event.target).attr('stroke', 'black').attr('stroke-width', 2);
        // 计算悬浮节点的位置，据此放置 tooltip：需要取父节点的位置
        // 以及鼠标的位置
        const parentPosition = rootRef.current?.getBoundingClientRect();
        const nodeX = event.clientX - parentPosition!.left;
        const nodeY = event.clientY - parentPosition!.top;

        if (!_isDragging) {
          setHoveredNode({ ...cloneObj(d), nodeX, nodeY });
        }
      })
      .on('mouseout', () => {
        setHoveredNode(null);
      })
      .on('click', function (event, d) {
        const isAlreadySelected = selectedNodesRef.current.some(
          node => node.id === d.id
        );

        // 更新选中的节点
        if (isAlreadySelected) {
          selectedNodesRef.current = selectedNodesRef.current.filter(
            node => node.id !== d.id
          );
        } else {
          selectedNodesRef.current = [d, ...selectedNodesRef.current];
        }

        // 为选中的节点加上外圈，取消选中时移除
        select(this)
          .attr('r', isAlreadySelected ? 8 : 16)
          .attr('stroke', isAlreadySelected ? 'transparent' : 'black')
          .attr('stroke-width', isAlreadySelected ? 0 : 2);

        // 渲染选中的节点
        setRender(prev => prev + 1);
      })
      .on('dblclick', (event, d) => {
        onNodeClick && onNodeClick(d);
        // 移除选中的节点
        setHoveredNode(null);
      })
      .call(
        drag<SVGCircleElement, any>()
          .on('start', (event, d) => {
            _isDragging = true;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            _isDragging = true;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
            _isDragging = false;
          })
      );

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);

      node.attr('cx', d => (d as any).x).attr('cy', d => (d as any).y);
    });
  }, [JSON.stringify(data), width, height, theme]);

  return (
    <DataExplorerRoot ref={rootRef}>
      <svg ref={svgRef} width={width} height={height}>
        <g ref={gRef} />
      </svg>
      {selectedNodesRef.current.length > 0 && (
        <SelectedNodes data-render={render}>
          {selectedNodesRef.current.map(node => (
            <DataPanel key={node.id} node={node} color={color} />
          ))}
        </SelectedNodes>
      )}
      {hoveredNode && (
        <DataPanel key={hoveredNode.id} node={hoveredNode} color={color} />
      )}
    </DataExplorerRoot>
  );
};

export default DataExplorer;
