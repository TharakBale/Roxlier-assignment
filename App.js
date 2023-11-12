import React, { useState, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import axios from 'axios';
import "./App.css"

const App = () => {
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('03');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [statistics, setStatistics] = useState({});
  const [barChartData, setBarChartData] = useState({});
  

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get(`/transactions?month=${selectedMonth}&search=${searchText}&page=${page}`);
        setTransactions(response.data);
      } catch (error) {
        console.error('Error fetching transactions:', error.message);
      }
    };

    


    // Fetch statistics data
    const fetchStatistics = async () => {
      try {
        const response = await axios.get(`/statistics?month=${selectedMonth}`);
        setStatistics(response.data);
      } catch (error) {
        console.error('Error fetching statistics:', error.message);
      }
    };

    
    const fetchBarChartData = async () => {
      try {
        const response = await axios.get(`/bar-chart?month=${selectedMonth}`);
        console.log('Bar Chart Data:', response.data);
        setBarChartData(response.data);
      } catch (error) {
        console.error('Error fetching bar chart data:', error.message);
      }
    };

    fetchTransactions();
    fetchStatistics();
    fetchBarChartData();
  }, [selectedMonth, searchText, page]);

  useEffect(() => {
    const ctx = document.getElementById('barChart');
    
    if (ctx.chart) {
      ctx.chart.destroy();
    }
  
    const newChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(barChartData),
        datasets: [{
          label: 'Number of Items',
          data: Object.values(barChartData),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        scales: {
          x: {
            type: 'category',
          },
          y: {
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  
  
    ctx.chart = newChart;
  
  
    return () => {
      newChart.destroy();
    };
  }, [barChartData]);

  

  const handleNextPage = () => {
    setPage(page + 1);
  };

  const handlePrevPage = () => {
    setPage(Math.max(page - 1, 1));
  };

  return (
    <div className='app-container'>
     <h1>Transactions Table</h1>
      <label htmlFor="monthDropdown">Select Month:</label>
      <select id="monthDropdown" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
        <option value="01">January</option>
        <option value="02">February</option>
        <option value="03">March</option>
        <option value="04">April</option>
        <option value="05">May</option>
        <option value="06">June</option>
        <option value="07">Julai</option>
        <option value="08">August</option>
        <option value="09">September</option>
        <option value="10">October</option>
        <option value="11">November</option>
        <option value="12">December</option>
      </select>
      <input
        type="text"
        placeholder="Search transactions..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />
      <button onClick={() => setPage(page - 1)}>Previous</button>
      <button onClick={() => setPage(page + 1)}>Next</button>
      <table className='transaction-table'>
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
        
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <tr key={transaction.id}>
              <td>{transaction.title}</td>
              <td>{transaction.description}</td>
              
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handlePrevPage}>Previous</button>
      <button onClick={handleNextPage}>Next</button>

      <h1>Transactions Statistics</h1>
      <div>
        <p>Total Sale Amount: {statistics.totalSale}</p>
        <p>Total Sold Items: {statistics.totalSoldItems}</p>
        <p>Total Not Sold Items: {statistics.totalNotSoldItems}</p>
      </div>

      <h1>Transactions Bar Chart</h1>
      <canvas id="barChart" width="400" height="200"></canvas>
    </div>
  );
};

export default App;