import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Format currency for tooltip
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-md shadow-sm">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-purple">
          Revenue: {formatCurrency(payload[0].value)}
        </p>
        <p className="text-pink-500">
          Orders: {payload[1].value}
        </p>
      </div>
    );
  }

  return null;
};

const SalesChart = () => {
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

  if (error || !dashboardData?.monthlySalesData) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Failed to load sales data</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={dashboardData.monthlySalesData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="month" 
          tick={{ fill: '#666' }}
          axisLine={{ stroke: '#e0e0e0' }}
        />
        <YAxis 
          yAxisId="left"
          tick={{ fill: '#666' }}
          axisLine={{ stroke: '#e0e0e0' }}
          tickFormatter={(value) => `$${value}`}
        />
        <YAxis 
          yAxisId="right" 
          orientation="right"
          tick={{ fill: '#666' }}
          axisLine={{ stroke: '#e0e0e0' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#800080"
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: '#800080', strokeWidth: 2 }}
          name="Revenue"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#FFC0CB"
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: '#FFC0CB', strokeWidth: 2 }}
          name="Orders"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SalesChart;
