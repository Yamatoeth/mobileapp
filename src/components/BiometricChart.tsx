/**
 * BiometricChart - Simple SVG line chart for biometric history
 * Lightweight implementation without external charting dependencies
 */
import { View, Text, Dimensions } from 'react-native';
import { useMemo } from 'react';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DataPoint {
  value: number;
  timestamp: Date;
}

interface BiometricChartProps {
  data: DataPoint[];
  height?: number;
  width?: number;
  color?: string;
  label?: string;
  unit?: string;
  showGradient?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BiometricChart({
  data,
  height = 150,
  width = SCREEN_WIDTH - 48,
  color = '#8b5cf6',
  label,
  unit,
  showGradient = true,
}: BiometricChartProps) {
  const { isDark } = useTheme();
  
  const chartConfig = useMemo(() => {
    if (data.length < 2) {
      return null;
    }

    const padding = { top: 20, right: 16, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate min/max with padding
    const values = data.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const valuePadding = valueRange * 0.1;

    const yMin = minValue - valuePadding;
    const yMax = maxValue + valuePadding;

    // Generate points
    const points = data.map((point, index) => {
      const x = padding.left + (index / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.value - yMin) / (yMax - yMin)) * chartHeight;
      return { x, y, ...point };
    });

    // Generate SVG path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Smooth curve using bezier
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      linePath += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`;
    }
    linePath += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

    // Gradient area path
    const areaPath =
      linePath +
      ` L ${points[points.length - 1].x} ${padding.top + chartHeight}` +
      ` L ${points[0].x} ${padding.top + chartHeight} Z`;

    // Y-axis labels (3 values)
    const yLabels = [
      { value: yMax, y: padding.top },
      { value: (yMax + yMin) / 2, y: padding.top + chartHeight / 2 },
      { value: yMin, y: padding.top + chartHeight },
    ];

    // X-axis labels (first and last)
    const xLabels = [
      { time: formatTime(data[0].timestamp), x: padding.left },
      { time: formatTime(data[data.length - 1].timestamp), x: padding.left + chartWidth },
    ];

    // Current/latest value
    const latestPoint = points[points.length - 1];

    return {
      padding,
      chartWidth,
      chartHeight,
      points,
      linePath,
      areaPath,
      yLabels,
      xLabels,
      latestPoint,
      avgValue: values.reduce((sum, v) => sum + v, 0) / values.length,
    };
  }, [data, width, height]);

  const textColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  // Empty state
  if (!chartConfig || data.length < 2) {
    return (
      <View
        className={`rounded-xl items-center justify-center ${
          isDark ? 'bg-gray-800' : 'bg-gray-50'
        }`}
        style={{ height, width }}
      >
        <Text className={isDark ? 'text-gray-500' : 'text-gray-400'}>
          Not enough data to display chart
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Label */}
      {label && (
        <View className="flex-row items-center justify-between mb-2 px-1">
          <Text className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {label}
          </Text>
          <Text style={{ color }} className="font-semibold">
            {Math.round(chartConfig.latestPoint.value)}
            {unit && <Text className="text-xs font-normal"> {unit}</Text>}
          </Text>
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={isDark ? '#1f2937' : '#f9fafb'}
          rx={12}
        />

        {/* Horizontal grid lines */}
        {chartConfig.yLabels.map((label, i) => (
          <Line
            key={`grid-${i}`}
            x1={chartConfig.padding.left}
            y1={label.y}
            x2={chartConfig.padding.left + chartConfig.chartWidth}
            y2={label.y}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Gradient fill */}
        {showGradient && (
          <Path
            d={chartConfig.areaPath}
            fill={`url(#gradient-${color})`}
          />
        )}

        {/* Line */}
        <Path
          d={chartConfig.linePath}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Latest point dot */}
        <Circle
          cx={chartConfig.latestPoint.x}
          cy={chartConfig.latestPoint.y}
          r={5}
          fill={color}
        />
        <Circle
          cx={chartConfig.latestPoint.x}
          cy={chartConfig.latestPoint.y}
          r={8}
          fill={color}
          opacity={0.3}
        />

        {/* Y-axis labels */}
        {chartConfig.yLabels.map((label, i) => (
          <SvgText
            key={`y-${i}`}
            x={chartConfig.padding.left - 8}
            y={label.y + 4}
            fontSize={10}
            fill={textColor}
            textAnchor="end"
          >
            {Math.round(label.value)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {chartConfig.xLabels.map((label, i) => (
          <SvgText
            key={`x-${i}`}
            x={label.x}
            y={height - 8}
            fontSize={10}
            fill={textColor}
            textAnchor={i === 0 ? 'start' : 'end'}
          >
            {label.time}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/**
 * BiometricDualChart - Side-by-side HRV and BPM mini charts
 */
interface DualChartProps {
  hrvData: DataPoint[];
  bpmData: DataPoint[];
}

export function BiometricDualChart({ hrvData, bpmData }: DualChartProps) {
  const chartWidth = (SCREEN_WIDTH - 64) / 2;

  return (
    <View className="flex-row gap-4">
      <View className="flex-1">
        <BiometricChart
          data={hrvData}
          width={chartWidth}
          height={120}
          color="#8b5cf6"
          label="HRV"
          unit="ms"
        />
      </View>
      <View className="flex-1">
        <BiometricChart
          data={bpmData}
          width={chartWidth}
          height={120}
          color="#ef4444"
          label="BPM"
        />
      </View>
    </View>
  );
}
