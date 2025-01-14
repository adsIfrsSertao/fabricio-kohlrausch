const Sequelize = require("sequelize");
const connection = require("./database");

// Modelo Cadastro
const Cadastro = connection.define('cadastros', {
    nome: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    email: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    cpf: {
        type: Sequelize.STRING,
        allowNull: true
    },
    data_nascimento: {
        type: Sequelize.DATE,
        allowNull: true
    },
    senha: {
        type: Sequelize.STRING,
        allowNull: true
    },
    googleId: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

// Modelo Carona
const Carona = connection.define('caronas', {
    origem: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    destino: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    data: {
        type: Sequelize.DATE,
        allowNull: false
    },
    hora: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    numero_passageiros: { 
        type: Sequelize.INTEGER,
        allowNull: false
    },
    motoristaId: {  
        type: Sequelize.INTEGER,
        references: {
            model: 'motoristas', 
            key: 'id'
        }
    },
    veiculoId: { 
        type: Sequelize.INTEGER,
        references: {
            model: 'veiculos', 
            key: 'id'
        }
    },
    userId: { // Adicionando o campo userId
        type: Sequelize.STRING, // Use STRING porque é provável que seja o ID de autenticação do Google (como um UUID)
        allowNull: false, // Opcional, dependendo da sua regra
        references: {
            model: 'usuarios', // Nome da tabela de usuários no banco de dados
            key: 'id'
        }
    }
   
});

// Modelo Motorista
const Motorista = connection.define('motoristas', {
    nome_motorista: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    cnh: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    numero_telefone: {
        type: Sequelize.TEXT,
        allowNull: false
    },
});

// Modelo Veiculo
const Veiculo = connection.define('veiculos', {
    tipo_carro: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    modelo_veiculo: { 
        type: Sequelize.TEXT,
        allowNull: false
    },
    cor_carro: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    placa: {
        type: Sequelize.TEXT,
        allowNull: false
    },
});

// Modelo Reserva (Tabela intermediária entre Cadastro e Carona)
const Reserva = connection.define('reservas', {
    cadastroId: {  
        type: Sequelize.INTEGER,
        references: {
            model: 'cadastros', 
            key: 'id'
        }
    },
    caronaId: {  
        type: Sequelize.INTEGER,
        references: {
            model: 'caronas', 
            key: 'id'
        }
    }
});

// Definindo as relações com 'onDelete: CASCADE'
Cadastro.hasMany(Reserva, { foreignKey: 'cadastroId', onDelete: 'CASCADE' });
Reserva.belongsTo(Cadastro, { foreignKey: 'cadastroId' });

Carona.hasMany(Reserva, { foreignKey: 'caronaId', onDelete: 'CASCADE' });
Reserva.belongsTo(Carona, { foreignKey: 'caronaId' });

Motorista.hasMany(Carona, { foreignKey: 'motoristaId', onDelete: 'CASCADE' });
Carona.belongsTo(Motorista, { foreignKey: 'motoristaId' });

Veiculo.hasMany(Carona, { foreignKey: 'veiculoId', onDelete: 'CASCADE' });
Carona.belongsTo(Veiculo, { foreignKey: 'veiculoId' });

// Sincronizando o banco de dados
connection.sync({ force: false }) // Use { force: true } para recriar as tabelas
    .then(() => {
        console.log("Tabelas criadas ou atualizadas!");
    })
    .catch((erro) => {
        console.log("Erro ao criar tabelas", erro);
    });

// Função para buscar cadastro com caronas associadas
const buscarCadastroComCaronas = async (cadastroId) => {
    try {
        const cadastro = await Cadastro.findOne({
            where: { id: cadastroId },
            include: [
                {
                    model: Reserva,
                    include: [
                        {
                            model: Carona,
                            include: [
                                { model: Motorista },
                                { model: Veiculo }
                            ]
                        }
                    ]
                }
            ]
        });

        console.log(cadastro);  // Exibe o cadastro com as reservas e caronas associadas
    } catch (erro) {
        console.error("Erro ao buscar cadastro:", erro);
    }
};

// Função para excluir uma carona e garantir que as reservas associadas também sejam excluídas
const excluirCarona = async (caronaId) => {
    try {
        const result = await Carona.destroy({ where: { id: caronaId } });
        if (result > 0) {
            console.log("Carona excluída com sucesso!");
        } else {
            console.log("Carona não encontrada.");
        }
    } catch (erro) {
        if (erro.name === 'SequelizeForeignKeyConstraintError') {
            console.error("Não é possível excluir a carona porque ela tem reservas associadas.");
        } else {
            console.error("Erro ao excluir carona:", erro);
        }
    }
};

// Testando a exclusão e a consulta
excluirCarona(1);
buscarCadastroComCaronas(1);

// Exportando os modelos
module.exports = { Cadastro, Carona, Motorista, Veiculo, Reserva };
