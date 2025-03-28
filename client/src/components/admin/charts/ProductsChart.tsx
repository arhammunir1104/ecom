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

// Sample data - In a real app, this would come from the API
const generateSampleData = () => {
  const products = [
    "Pink Floral Dress",
    "Elegant White Blouse",
    "High-Waisted Pants",
    "Pearl Necklace",
    "Gold Earrings",
  ];
  
  return products.map((product, index) => {
    // Base sales values
    const baseSales = 100 - (index * 15); // Decreasing sales by index to show a ranking
    
    // Add randomness (up to ±15%)
    const randomFactor = 0.85 + (Math.random() * 0.3);
    
    return {
      name: product,
      sales: Math.round(baseSales * randomFactor),
    };
  }).sort((a, b) => b.sales - a.sales); // Sort by sales in descending order
};

const data = generateSampleData();

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
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
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
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProductsChart;
