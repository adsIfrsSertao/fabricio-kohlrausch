const Sequelize = require("sequelize");
const connection = require("./database");
const Cadastro = require('./Cadastro'); // Certifique-se de que o caminho está correto
const Carona = require('./Cadastro'); // Certifique-se de que o caminho está correto

// Modelo Reserva
const Reserva = connection.define('reservas', {
    cadastroId: {  // Adicionando a chave estrangeira para cadastro
        type: Sequelize.INTEGER,
        references: {
            model: 'cadastros', // Nome da tabela a que se refere
            key: 'id' // Chave primária da tabela referenciada
        }
    },
    caronaId: {  // Adicionando a chave estrangeira para carona
        type: Sequelize.INTEGER,
        references: {
            model: 'caronas', // Nome da tabela a que se refere
            key: 'id' // Chave primária da tabela referenciada
        }
    }
});

// Definindo as relações entre os modelos
Cadastro.hasMany(Reserva, { foreignKey: 'cadastroId' }); // Um cadastro pode ter várias reservas
Reserva.belongsTo(Cadastro, { foreignKey: 'cadastroId' }); // Cada reserva pertence a um cadastro

Carona.hasMany(Reserva, { foreignKey: 'caronaId' }); // Uma carona pode ter várias reservas
Reserva.belongsTo(Carona, { foreignKey: 'caronaId' }); // Cada reserva pertence a uma carona

// Sincronizando o banco de dados
connection.sync({ force: false }) // Mude para true se quiser recriar as tabelas
    .then(() => {
        console.log("Tabelas criadas ou atualizadas!");
    })
    .catch((erro) => {
        console.log("Erro ao criar tabelas", erro);
    });

// Exportando os modelos
module.exports = { Cadastro, Carona, Reserva };
