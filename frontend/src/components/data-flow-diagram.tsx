'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api, DataFlow } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { ErrorAlert } from './ui/error-alert';
import { Loading } from './ui/loading';

// Define node types
const nodeTypes: NodeTypes = {
  source: ({ data }) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-green-50 border-2 border-green-500 dark:bg-green-900/30 dark:border-green-700">
      <div className="font-bold text-green-800 dark:text-green-300">{data.label}</div>
      <div className="text-sm text-green-700 dark:text-green-400">{data.type}</div>
      {data.variableName && (
        <div className="text-xs mt-1 text-green-600 dark:text-green-500">
          Variable: {data.variableName}
        </div>
      )}
    </div>
  ),
  transformation: ({ data }) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-blue-50 border-2 border-blue-500 dark:bg-blue-900/30 dark:border-blue-700">
      <div className="font-bold text-blue-800 dark:text-blue-300">{data.label}</div>
      <div className="text-sm text-blue-700 dark:text-blue-400">{data.type}</div>
      {data.dataframeName && (
        <div className="text-xs mt-1 text-blue-600 dark:text-blue-500">
          DataFrame: {data.dataframeName}
        </div>
      )}
    </div>
  ),
  sink: ({ data }) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-purple-50 border-2 border-purple-500 dark:bg-purple-900/30 dark:border-purple-700">
      <div className="font-bold text-purple-800 dark:text-purple-300">{data.label}</div>
      <div className="text-sm text-purple-700 dark:text-purple-400">{data.type}</div>
      {data.dataframeName && (
        <div className="text-xs mt-1 text-purple-600 dark:text-purple-500">
          DataFrame: {data.dataframeName}
        </div>
      )}
    </div>
  ),
};

interface DataFlowDiagramProps {
  repositoryId: number;
}

export function DataFlowDiagram({ repositoryId }: DataFlowDiagramProps) {
  // Fetch data flow information
  const { 
    data: dataFlow, 
    error, 
    isLoading, 
    refetch 
  } = useApi<DataFlow>(api.getDataFlow.bind(api), [repositoryId], true, `dataflow-${repositoryId}`);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [fitView, setFitView] = useState(false);

  // Convert data flow to nodes and edges
  const processDataFlow = useCallback((data: DataFlow) => {
    if (!data) return { nodes: [], edges: [] };

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Process sources
    data.sources.forEach((source, index) => {
      const nodeId = `source-${source.id}`;
      newNodes.push({
        id: nodeId,
        type: 'source',
        position: { x: 100, y: index * 150 },
        data: {
          label: source.arguments || 'Source',
          type: source.type,
          variableName: source.variable_name,
        },
      });
      
      // If this source has a variable name, add edges to transformations using it
      if (source.variable_name) {
        data.transformations.forEach((transformation) => {
          if (transformation.dataframe_name === source.variable_name) {
            newEdges.push({
              id: `${nodeId}-to-transformation-${transformation.id}`,
              source: nodeId,
              target: `transformation-${transformation.id}`,
              animated: true,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#2463EB',
              },
            });
          }
        });
      }
    });
    
    // Process transformations
    data.transformations.forEach((transformation, index) => {
      const nodeId = `transformation-${transformation.id}`;
      newNodes.push({
        id: nodeId,
        type: 'transformation',
        position: { x: 400, y: index * 150 },
        data: {
          label: transformation.arguments?.toString() || 'Transformation',
          type: transformation.type,
          dataframeName: transformation.dataframe_name,
        },
      });
      
      // Connect to sinks
      if (transformation.dataframe_name) {
        data.sinks.forEach((sink) => {
          if (sink.dataframe_name === transformation.dataframe_name) {
            newEdges.push({
              id: `${nodeId}-to-sink-${sink.id}`,
              source: nodeId,
              target: `sink-${sink.id}`,
              animated: true,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#9333EA',
              },
            });
          }
        });
        
        // Connect to other transformations
        data.transformations.forEach((nextTransformation) => {
          if (
            nextTransformation.id !== transformation.id &&
            nextTransformation.dataframe_name === transformation.dataframe_name
          ) {
            newEdges.push({
              id: `${nodeId}-to-transformation-${nextTransformation.id}`,
              source: nodeId,
              target: `transformation-${nextTransformation.id}`,
              animated: true,
              style: { stroke: '#64748B' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#64748B',
              },
            });
          }
        });
      }
    });
    
    // Process sinks
    data.sinks.forEach((sink, index) => {
      newNodes.push({
        id: `sink-${sink.id}`,
        type: 'sink',
        position: { x: 700, y: index * 150 },
        data: {
          label: sink.arguments?.toString() || 'Sink',
          type: sink.type,
          dataframeName: sink.dataframe_name,
        },
      });
    });
    
    return { nodes: newNodes, edges: newEdges };
  }, []);
  
  // Layout nodes in a more readable way
  const layoutNodes = useCallback((nodes: Node[], edges: Edge[]) => {
    // Group nodes by type
    const sourceNodes = nodes.filter(node => node.type === 'source');
    const transformationNodes = nodes.filter(node => node.type === 'transformation');
    const sinkNodes = nodes.filter(node => node.type === 'sink');
    
    // Calculate vertical spacing
    const verticalSpacing = 150;
    const totalHeight = Math.max(
      sourceNodes.length,
      transformationNodes.length,
      sinkNodes.length
    ) * verticalSpacing;
    
    // Position nodes in columns
    sourceNodes.forEach((node, index) => {
      node.position = {
        x: 100,
        y: index * verticalSpacing + 50,
      };
    });
    
    transformationNodes.forEach((node, index) => {
      node.position = {
        x: 400,
        y: index * verticalSpacing + 50,
      };
    });
    
    sinkNodes.forEach((node, index) => {
      node.position = {
        x: 700,
        y: index * verticalSpacing + 50,
      };
    });
    
    return nodes;
  }, []);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (dataFlow) {
      const { nodes: newNodes, edges: newEdges } = processDataFlow(dataFlow);
      const layoutedNodes = layoutNodes(newNodes, newEdges);
      
      setNodes(layoutedNodes);
      setEdges(newEdges);
      setFitView(true);
    }
  }, [dataFlow, processDataFlow, layoutNodes, setNodes, setEdges]);

  // Reset fit view after the diagram is rendered
  useEffect(() => {
    if (fitView) {
      setTimeout(() => setFitView(false), 100);
    }
  }, [fitView]);

  // Handle retry on error
  const handleRetry = () => {
    refetch();
  };

  // Check if data flow is empty
  const isEmptyDataFlow = useMemo(() => {
    if (!dataFlow) return true;
    return (
      dataFlow.sources.length === 0 &&
      dataFlow.transformations.length === 0 &&
      dataFlow.sinks.length === 0
    );
  }, [dataFlow]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <Loading text="Loading data flow diagram..." />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <ErrorAlert
          title="Failed to load data flow"
          message="Could not retrieve data flow information for this repository."
          details={error.message}
        />
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (isEmptyDataFlow) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          No Data Flow Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          This repository does not contain any recognized Spark data flow patterns.
          <br />
          The system looks for Spark operations like <code>spark.read</code>, <code>dataframe.filter</code>, and <code>dataframe.write</code>.
        </p>
      </div>
    );
  }

  // Render flow diagram
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[600px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={fitView}
        minZoom={0.2}
        maxZoom={1.5}
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
          nodeColor={(node) => {
            switch (node.type) {
              case 'source':
                return '#22c55e';
              case 'transformation':
                return '#3b82f6';
              case 'sink':
                return '#a855f7';
              default:
                return '#64748b';
            }
          }}
        />
        <Background color="#aaa" gap={16} />
        <Panel position="top-left" className="bg-white dark:bg-gray-700 p-2 rounded shadow-md">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Data Flow Legend
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-300">Sources</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-300">Transformations</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-300">Sinks</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default DataFlowDiagram;