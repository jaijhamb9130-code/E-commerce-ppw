const mysql = require('mysql2/promise');

async function purge() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'user',
    password: 'password',
    database: 'tally_sync'
  });

  console.log('Connected to DB. Starting purge...');

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    console.log('Purging order_detail...');
    await connection.query('TRUNCATE TABLE order_detail');
    
    console.log('Purging order...');
    await connection.query('TRUNCATE TABLE `order`');
    
    console.log('Pruning users...');
    await connection.query("DELETE FROM user WHERE username NOT IN ('admin')");
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Purge successful!');
  } catch (error) {
    console.error('Purge failed:', error);
  } finally {
    await connection.end();
  }
}

purge();
