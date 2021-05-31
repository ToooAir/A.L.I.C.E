const mysql = require('mysql');
const {mysqlConnect} = require('../config');

const pool = mysql.createPool(mysqlConnect);


function createReply(input, output){
    return new Promise((resolve,reject) =>{
        pool.query('INSERT INTO reply (input, output) VALUES (?, ?);', [input, output],
            function (err, results, fields) {
                if (err) throw err;
                console.log('Inserted ' + results.affectedRows + ' row(s).');
            }
        );
        resolve();
    });
    
};

function readReply(input){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM reply where input = ? LIMIT 1', [input],
            function (err, results, fields) {
                if (err) throw err;

                resolve(results[0]);
                
            }
        );

    });
    
};

function updateReply(input, output){
    return new Promise((resolve,reject) => {
        pool.query('UPDATE reply SET output = ? WHERE input = ?', [output, input], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
    
};

function deleteReply(input){
    return new Promise((resolve,reject) => {
        pool.query('DELETE FROM reply WHERE input = ?', [input], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
    
};

function searchReply(input){
    return new Promise((resolve,reject) => {
        pool.query("SELECT * FROM reply WHERE input LIKE ? or output LIKE ? ORDER BY id DESC", ['%'+[input]+'%','%'+[input]+'%'],
            function (err, results, fields) {
                if (err) throw err;

                resolve(results);
            }
        );
    })

}

module.exports = {
    createReply: createReply,
    readReply: readReply,
    updateReply: updateReply,
    deleteReply: deleteReply,
    searchReply: searchReply
}