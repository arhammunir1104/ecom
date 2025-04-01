import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Colors for the bars
const colors = [
  "#800080", // Purple
  "#9B329B", // Light purple
  "#B646B6", // Lighter purple
  "#D160D1", // Even lighter purple
  "#EE82EE", // Lavender
];

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-md shadow-sm">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-purple">
          Sales: {payload[0].value} units
        </p>
      </div>
    );
  }

  return null;
};

const ProductsChart = () => {
  // Fetch dashboard data from API
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/dashboard'],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboardData?.topProducts) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Failed to load product data</p>
      </div>
    );
  }

  // Format the data for the chart
  const chartData = dashboardData.topProducts.map((item: any) => ({
    name: item.product.name,
    sales: item.soldCount
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{
          top: 5,
          right: 30,
          left: 100, // Extra space for longer product names
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
        <XAxis 
          type="number"
          tick={{ fill: '#666' }}
          axisLine={{ stroke: '#e0e0e0' }}
        />
        <YAxis 
          type="category"
          dataKey="name" 
          tick={{ fill: '#666' }}
          axisLine={{ stroke: '#e0e0e0' }}
          width={90}
          tickFormatter={(value) => {
            // Truncate long product names
            return value.length > 18 ? value.substring(0, 15) + '...' : value;
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="sales" name="Sales (units)" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProductsChart;
