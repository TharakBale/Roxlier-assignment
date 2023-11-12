const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const axios = require("axios");
const path = require("path");
const bodyParser = require("body-parser");

const databasePath = path.join(__dirname, "datasource.db");
const THIRD_PARTY_API_URL = "https://s3.amazonaws.com/roxiler.com/product_transaction.json";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    await database.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        price INTEGER,
        dateOfSale DATE,
        category TEXT
      );
    `);

    await fetchAndSeedData();

    app.listen(4000, () =>
      console.log("Server Running at http://localhost:4000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

const fetchAndSeedData = async () => {
  try {
    const response = await axios.get(THIRD_PARTY_API_URL);
    const transactions = response.data;

    await Promise.all(
      transactions.map(async (transaction) => {
        await database.run(
          `INSERT INTO transactions (title, description, price, dateOfSale, category) 
          VALUES (?, ?, ?, ?, ?)`,
          [transaction.title, transaction.description, transaction.price, transaction.dateOfSale, transaction.category]
        );
      })
    );
  } catch (error) {
    console.log(`Error fetching and seeding data: ${error.message}`);
  }
};

// API to list all transactions with search and pagination
app.get("/transactions", async (req, res) => {
  try {
    const { page = 1, perPage = 10, search } = req.query;
    const offset = (page - 1) * perPage;

    let query = "SELECT * FROM transactions";
    let countQuery = "SELECT COUNT(*) as total FROM transactions";

    if (search) {
      query += ` WHERE title LIKE '%${search}%' OR description LIKE '%${search}%' OR price LIKE '%${search}%'`;
      countQuery += ` WHERE title LIKE '%${search}%' OR description LIKE '%${search}%' OR price LIKE '%${search}%'`;
    }

    query += ` LIMIT ${perPage} OFFSET ${offset}`;

    const transactions = await database.all(query);
    const total = await database.get(countQuery);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total.total,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// API for statistics
app.get("/statistics/:month", async (req, res) => {
  try {
    const { month } = req.params;

    const totalSaleQuery = `
      SELECT SUM(price) as totalSaleAmount
      FROM transactions
      WHERE strftime('%m', dateOfSale) = ?;
    `;

    const soldItemsQuery = `
      SELECT COUNT(*) as totalSoldItems
      FROM transactions
      WHERE strftime('%m', dateOfSale) = ?;
    `;

    const notSoldItemsQuery = `
      SELECT COUNT(*) as totalNotSoldItems
      FROM transactions
      WHERE strftime('%m', dateOfSale) = ? AND dateOfSale IS NULL;
    `;

    const totalSaleResult = await database.get(totalSaleQuery, [month]);
    const soldItemsResult = await database.get(soldItemsQuery, [month]);
    const notSoldItemsResult = await database.get(notSoldItemsQuery, [month]);

    res.json({
      totalSaleAmount: totalSaleResult.totalSaleAmount || 0,
      totalSoldItems: soldItemsResult.totalSoldItems || 0,
      totalNotSoldItems: notSoldItemsResult.totalNotSoldItems || 0,
    });
  } catch (error) {
    console.error("Error calculating statistics:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// API for bar chart
app.get("/bar-chart/:month", async (req, res) => {
  try {
    const { month } = req.params;

    const priceRanges = [
      { min: 0, max: 100 },
      { min: 101, max: 200 },
      { min: 201, max: 300 },
      { min: 301, max: 400 },
      { min: 401, max: 500 },
      { min: 501, max: 600 },
      { min: 601, max: 700 },
      { min: 701, max: 800 },
      { min: 801, max: 900 },
      { min: 901, max: Number.MAX_SAFE_INTEGER },
    ];

    const barChartData = [];

    for (const range of priceRanges) {
      const { min, max } = range;

      const itemsInRangeQuery = `
        SELECT COUNT(*) as itemsCount
        FROM transactions
        WHERE strftime('%m', dateOfSale) = ? AND price >= ? AND price <= ?;
      `;

      const itemsInRangeResult = await database.get(itemsInRangeQuery, [
        month,
        min,
        max,
      ]);

      barChartData.push({
        priceRange: `${min}-${max}`,
        itemsCount: itemsInRangeResult.itemsCount || 0,
      });
    }

    res.json(barChartData);
  } catch (error) {
    console.error("Error generating bar chart data:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// API for pie chart
app.get("/pie-chart/:month", async (req, res) => {
  try {
    const { month } = req.params;

    const categoriesQuery = `
      SELECT DISTINCT category
      FROM transactions
      WHERE strftime('%m', dateOfSale) = ?;
    `;

    const categories = await database.all(categoriesQuery, [month]);

    const pieChartData = [];

    for (const category of categories) {
      const { category: categoryName } = category;

      const itemsInCategoryQuery = `
        SELECT COUNT(*) as itemsCount
        FROM transactions
        WHERE strftime('%m', dateOfSale) = ? AND category = ?;
      `;

      const itemsInCategoryResult = await database.get(itemsInCategoryQuery, [
        month,
        categoryName,
      ]);

      pieChartData.push({
        category: categoryName,
        itemsCount: itemsInCategoryResult.itemsCount || 0,
      });
    }

    res.json(pieChartData);
  } catch (error) {
    console.error("Error generating pie chart data:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// API to fetch data from all APIs
app.get("/combined-data/:month", async (req, res) => {
  try {
    const { month } = req.params;

    const transactionsResponse = await axios.get(`http://localhost:4000/transactions?month=${month}`);
    const statisticsResponse = await axios.get(`http://localhost:4000/statcdistics/${month}`);
    const barChartResponse = await axios.get(`http://localhost:4000/bar-chart/${month}`);
    const pieChartResponse = await axios.get(`http://localhost:4000/pie-chart/${month}`);

    const combinedData = {
      transactions: transactionsResponse.data,
      statistics: statisticsResponse.data,
      barChart: barChartResponse.data,
      pieChart: pieChartResponse.data,
    };

    res.json(combinedData);
  } catch (error) {
    console.error("Error fetching and combining data:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

initializeDbAndServer();
