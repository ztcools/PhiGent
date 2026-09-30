import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { useTheme, Box } from '@mui/material';
import CustomButton from '@/components/customButton/CustomButton';
import type { DBCollectionsPrivileges, RBACOptions } from '@server/types';

interface Props {
  privileges: DBCollectionsPrivileges;
  role: string;
  margin?: { top: number; right: number; bottom: number; left: number };
  rbacOptions: RBACOptions;
}

interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: boolean;
  type?: string;
}

const D3PrivilegeTree: React.FC<Props> = ({
  role,
  privileges,
  margin = { top: 20, right: 20, bottom: 20, left: 60 },
  rbacOptions,
}) => {
  // 国际化
  const { t: btnTrans } = useTranslation('btn');
  const { t: userTrans } = useTranslation('user');

  // 主题
  const theme = useTheme();

  // SVG 和 G 元素的 ref
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  // 与 DBCollectionSelector 一样，推导出各选项数组。
  const rbacEntries = Object.entries(rbacOptions) as [
    string,
    Record<string, string>
  ][];

  // 权限组包含的权限
  const privilegeGroups = rbacEntries.filter(([key]) =>
    key.endsWith('PrivilegeGroups')
  );
  const groupPrivileges = new Set(
    privilegeGroups.reduce(
      (acc, [_, group]) => acc.concat(Object.values(group)),
      [] as string[]
    )
  );

  // 把权限数据转换为 d3.hierarchy 结构
  const transformData = (privileges: DBCollectionsPrivileges): TreeNode => {
    let nodeCount = 0;

    const res = {
      name: role,
      type: 'role',
      children: Object.entries(privileges).map(([dbKey, dbValue]) => ({
        name: dbKey === '*' ? 'All Databases(*)' : dbKey,
        type: 'database',
        children: Object.entries(dbValue.collections).map(
          ([colKey, colValue]) => {
            const children = Object.entries(colValue).map(([priv, val]) => {
              nodeCount += 1;
              return {
                name: priv,
                value: val,
              };
            });

            children.sort((a, b) => {
              const aInGroup = groupPrivileges.has(a.name);
              const bInGroup = groupPrivileges.has(b.name);
              return aInGroup === bInGroup ? 0 : aInGroup ? -1 : 1;
            });

            return {
              name: colKey === '*' ? 'All Collections(*)' : colKey,
              children,
              type: 'collection',
            };
          }
        ),
      })),
    };

    return res;
  };

  useEffect(() => {
    if (!privileges) return;

    const treeNode = transformData(privileges);

    // 通过访问 DOM 元素获取 svg 的宽高
    const svgWidth = svgRef.current?.clientWidth || 0;
    const svgHeight = svgRef.current?.clientHeight || 0;

    // 根据树结构而非节点总数计算高度
    // 用任意一层的最大节点数来推算所需纵向空间更准确
    const maxNodesAtLevel = Math.max(
      1, // Role 层
      Object.keys(privileges).length, // Database 层
      ...Object.values(privileges).map(
        db => Object.keys(db.collections).length
      ), // Collection 层
      ...Object.values(privileges).reduce(
        (acc, db) =>
          acc.concat(
            Object.values(db.collections).map(col => Object.keys(col).length)
          ),
        [] as number[] // 权限层
      )
    );

    // 增大系数，让节点之间留出更多间距
    const nodeSpacing = 30;
    let height =
      maxNodesAtLevel * nodeSpacing + margin.top + margin.bottom + 120; // 额外的内边距

    // 保证最小高度，以获得更好的可视化效果
    height = Math.max(height, svgHeight);

    // 为大数据量额外增加内边距
    if (maxNodesAtLevel > 15) {
      height += maxNodesAtLevel * 10; // 超大数据量的额外空间
    }

    const fontSize = 12; // 文字标签的字号
    const marginLeft = role.length * fontSize; // 根据 role 名称长度调整左边距

    // 清空 SVG
    d3.select(svgRef.current).selectAll('*').remove();

    // 创建层级结构并布局
    const root = d3.hierarchy<TreeNode>(treeNode);
    const treeLayout = d3
      .tree<TreeNode>()
      .size([height - margin.top - margin.bottom, svgWidth / 2])
      .separation((a: any, b: any) => {
        return a.parent === b.parent ? 3 : 4;
      }); // 交换宽高以实现纵向布局
    treeLayout(root);

    // 计算树的边界
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    root.each((d: any) => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
      if (d.y > y1) y1 = d.y;
      if (d.y < y0) y0 = d.y;
    });

    // 创建高度扩展后的 SVG 容器
    const svg = d3.select(svgRef.current);

    // 添加一个可缩放的容器分组
    const g = svg.append('g').attr('transform', `translate(0, ${margin.top})`); // 添加上边距
    gRef.current = g.node();

    const colorMap: { [key: string]: any } = {
      role: theme.palette.primary.dark,
      database: theme.palette.primary.dark,
      collection: theme.palette.primary.dark,
    };

    // 创建连线（节点之间的连接）
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => colorMap[d.source.data.type!])
      .attr('stroke-width', 1)
      .attr(
        'd',
        (d: any) =>
          `M${d.source.y},${d.source.x} C${(d.source.y + d.target.y) / 2},${
            d.source.x
          } ` +
          `${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${
            d.target.x
          }`
      );

    // 创建节点
    const nodes = g
      .selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y! + 3},${d.x})`);

    // 为节点添加圆形
    nodes
      .append('circle')
      .attr('r', 3)
      .attr('stroke', theme.palette.primary.main)
      .attr('fill', (d, index) =>
        d.children || index == 0 || groupPrivileges.has(d.data.name)
          ? `${theme.palette.primary.main}`
          : `transparent`
      );

    // 添加文字标签
    nodes
      .append('text')
      .attr('dy', d => (d.children && d.data.name !== role ? -3 : 3))
      .attr('x', d => (d.children ? -10 : 10))
      .attr('text-anchor', d => (d.children ? 'end' : 'start'))
      .attr('font-family', 'Inter')
      .attr('font-style', 'Italic')
      .attr('font-size', fontSize)
      .attr('fill', d =>
        groupPrivileges.has(d.data.name)
          ? `${theme.palette.primary.dark}`
          : `${theme.palette.text.primary}`
      )
      .text(d =>
        groupPrivileges.has(d.data.name) && d.data.type !== 'role'
          ? `${userTrans('privilegeGroup')}: ${d.data.name}`
          : d.data.name
      );

    // 计算缩放比例以适配整棵树
    const treeWidth = y1 - y0 + marginLeft + 50; // 添加一些内边距
    const treeHeight = x1 - x0 + 60; // 增大内边距
    const scaleX = svgWidth / treeWidth;
    const scaleY = svgHeight / treeHeight;
    const scale = Math.min(scaleX, scaleY, 0.95); // 略微缩小以确保完整可见

    // 计算平移量使树居中
    const centerX = (svgWidth - treeWidth * scale) / 2 - 60;
    const centerY =
      (svgHeight - treeHeight * scale) / 2 - x0 * scale + margin.top;

    // 添加缩放功能
    const zoom: any = d3
      .zoom()
      .scaleExtent([scale, 4]) // 最小缩放比例设为可容纳整棵树
      .on('zoom', event => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom); // 为 SVG 应用缩放

    // 应用初始变换以展示整棵树
    svg
      .transition()
      .duration(250)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(centerX, centerY).scale(scale)
      );
  }, [JSON.stringify({ privileges, margin, groupPrivileges, role })]);

  // 主题切换时更新颜色
  useEffect(() => {
    const updateColors = () => {
      const colorMap: { [key: string]: any } = {
        role: theme.palette.primary.dark,
        database: theme.palette.primary.dark,
        collection: theme.palette.primary.dark,
      };

      // 更新连线颜色
      d3.select(svgRef.current)
        .selectAll('.link')
        .attr('stroke', (d: any) => colorMap[d.source.data.type!]);

      // 更新节点颜色
      d3.select(svgRef.current)
        .selectAll('.node circle')
        .attr('stroke', theme.palette.primary.main)
        .attr('fill', (d: any, index) =>
          d.children || index == 0 || groupPrivileges.has(d.data.name)
            ? `${theme.palette.primary.main}`
            : `transparent`
        );

      // 更新文字颜色
      d3.select(svgRef.current)
        .selectAll('.node text')
        .attr('fill', (d: any) =>
          groupPrivileges.has(d.data.name)
            ? `${theme.palette.primary.dark}`
            : `${theme.palette.text.primary}`
        );
    };

    updateColors();
  }, [theme]);

  // UI 处理函数
  const handleDownload = () => {
    if (!svgRef.current) return;

    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `privilege_tree_${role}.svg`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <CustomButton
        sx={{
          alignSelf: 'left',
          width: 'fit-content',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        onClick={handleDownload}
      >
        {btnTrans('downloadChart')}
      </CustomButton>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>
    </Box>
  );
};

export default D3PrivilegeTree;
