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

// Sample data - In a real app, this would come from the API
const generateSampleData = () => {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  
  const currentMonth = new Date().getMonth();
  
  // Generate data for the past 12 months
  return months.map((month, index) => {
    // Seasonal variations
    let factor = 1;
    
    // Summer and winter have higher sales
    if (index >= 5 && index <= 7) factor = 1.5; // Summer
    if (index >= 10 || index <= 1) factor = 1.3; // Winter

    // Create slight upward trend over the year
    const trendFactor = 1 + (index * 0.02);
    
    // Base values with some randomness
    const baseRevenue = 2000 * factor * trendFactor;
    const baseOrders = 120 * factor * trendFactor;
    
    // Add randomness (up to ±20%)
    const randomFactorRevenue = 0.8 + (Math.random() * 0.4);
    const randomFactorOrders = 0.8 + (Math.random() * 0.4);
    
    return {
      month,
      revenue: Math.round(baseRevenue * randomFactorRevenue),
      orders: Math.round(baseOrders * randomFactorOrders),
    };
  }).slice(currentMonth + 1).concat(months.slice(0, currentMonth + 1).map((month, index) => {
    const factor = 1 + (index * 0.05);
    const baseRevenue = 2000 * factor;
    const baseOrders = 120 * factor;
    
    const randomFactorRevenue = 0.8 + (Math.random() * 0.4);
    const randomFactorOrders = 0.8 + (Math.random() * 0.4);
    
    return {
      month,
      revenue: Math.round(baseRevenue * randomFactorRevenue),
      orders: Math.round(baseOrders * randomFactorOrders),
    };
  }));
};

const data = generateSampleData();

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
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={data}
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
