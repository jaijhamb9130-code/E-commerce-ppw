const { createConnection } = require('mysql2/promise');

async function dropBarcodeColumns() {
    const connection = await createConnection({
        host: 'localhost',
        port: 3307,
        user: 'user',
        password: 'password',
        database: 'tally_sync'
    });

    try {
        console.log('Dropping ats_barcode from stock_item...');
        // Using plain ALTER TABLE as MySQL older versions might not support IF EXISTS
        // We catch the error specifically for "column doesn't exist" (1091)
        try {
            await connection.execute('ALTER TABLE stock_item DROP COLUMN ats_barcode');
            console.log('Dropped ats_barcode');
        } catch (e) {
            if (e.errno === 1091) console.log('ats_barcode already dropped');
            else throw e;
        }
        
        console.log('Dropping barcode from order_detail...');
        try {
            await connection.execute('ALTER TABLE order_detail DROP COLUMN barcode');
            console.log('Dropped barcode');
        } catch (e) {
            if (e.errno === 1091) console.log('barcode already dropped');
            else throw e;
        }

        console.log('Successfully completed database cleanup.');
    } catch (e) {
        console.error('Error dropping columns:', e.message);
    } finally {
        await connection.end();
    }
}

dropBarcodeColumns();
