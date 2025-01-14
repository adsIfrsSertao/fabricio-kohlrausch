const Sequelize = require("sequelize");
/*
const con = new Sequelize(
  'Fabricio_SITE',
  'root',
  'ifrs2022!',
  {
    host: '200.132.218.138',
    dialect: 'mysql',
    port: 3308
  }
);
*/
const connection = new Sequelize('teste_cadastro', 'root', '1234', {
  
  host: 'localhost',
  dialect: 'mysql',
  port: 3306
}
);
module.exports = connection;

// module.exports = con;