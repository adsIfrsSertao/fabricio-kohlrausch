const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const connection = require("./database/database");
const { Cadastro, Carona, Motorista, Veiculo, Reserva } = require("./database/Cadastro");
const transporter = require("./database/nodemailer");
const md5 = require('md5');
const { Sequelize } = require('sequelize');
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require('dotenv').config();

const app = express();
const PORT = 8000;

// Configuração do Passport
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8000/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { id: profile.id, name: profile.displayName });
}));

// Serialização do usuário
passport.serializeUser  ((user, done) => {
    done(null, user.id);
});

// Desserialização do usuário
passport.deserializeUser  ((id, done) => {
    Cadastro.findByPk(id).then((user) => {
        if (user) {
            done(null, { id: user.id, name: user.nome });
        } else {
            done(null, { id: id, name: "Usuário Desconhecido" });
        }
    });
});

// Configuração da sessão
app.use(session({
    secret: 'seu-segredo-aqui',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Defina como true se estiver usando HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Middleware para garantir que o usuário logado esteja disponível em todas as views
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || req.user || null;
    next();
});

// Middleware para verificar se o usuário está autenticado
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Conexão com o Banco de Dados
connection.authenticate()
    .then(() => { console.log("Conectado ao Banco de Dados com sucesso!") })
    .catch((erro) => {
        console.log("Conexão Falhou", erro);
    });

// Configurações do Express
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rota principal
app.get("/", (req, res) => {
    Cadastro.findAll()
        .then((cadastro) => {
            res.render("index", { cadastro });
        });
});

// Rota para registrar cadastro
app.post("/salvarcadastro", (req, res) => {
    let { nome, email, cpf, data_nascimento, senha, confisenha } = req.body;
    senha = md5(senha);
    confisenha = md5(confisenha);

    if (senha !== confisenha || !nome || !email || !senha || !cpf || !data_nascimento) {
        return res.redirect("/cadastrar");
    }

    Cadastro.create({ nome, email, senha, cpf, data_nascimento })
        .then(() => {
            res.redirect("/login");
            transporter.sendMail({ /* Configurações do email */ })
                .then((msg) => {
                    console.log(msg);
                }).catch((erro) => {
                    console.log(erro);
                });
        }).catch((erro) => {
            console.error(erro);
            res.redirect("/cadastrar");
        });
});

// Rota para listar caronas disponíveis 
app.get("/caronas-disponiveis", ensureAuthenticated, async (req, res) => {
    const { data, from, to } = req.query;

    try {
        // Construindo a condição de busca dinamicamente
        const where = {};

        // Verificando se a data foi fornecida e é válida
        if (data) {
            const parsedData = new Date(data);
            if (isNaN(parsedData.getTime())) {
                return res.render("caronas-disponiveis", { caronas: [], message: "Data inválida." });
            }
            where.data = { [Sequelize.Op.eq]: parsedData };
        }

        // Adicionando filtro para "Saindo de", se fornecido
        if (from) {
            where.origem = { [Sequelize.Op.eq]: from };
        }

        // Adicionando filtro para "Indo para", se fornecido
        if (to) {
            where.destino = { [Sequelize.Op.eq]: to };
        }

        // Buscando as caronas com os filtros
        const caronas = await Carona.findAll({
            where: Object.keys(where).length > 0 ? where : undefined, // Verifica se existem condições no 'where'
            include: [{ model: Motorista, required: true }, { model: Veiculo, required: true }]
        });

        // Renderizando a página com as caronas encontradas
        res.render("caronas-disponiveis", { 
            caronas, 
            message: caronas.length === 0 ? "Nenhuma carona disponível para os critérios informados." : undefined 
        });
    } catch (erro) {
        console.error("Erro ao buscar caronas:", erro);
        res.status(500).json({ error: "Erro ao buscar caronas." });
    }
});





// Rota para registrar carona
app.post("/registrar_carona", ensureAuthenticated, async (req, res) => {
    const { origem, destino, data, hora, numero_passageiros, nome_motorista, cnh,numero_telefone ,tipo_carro, modelo_veiculo, cor_carro, placa } = req.body;

    if (!origem || !destino || !data || !hora || !numero_passageiros || !nome_motorista || !cnh || !numero_telefone ||!tipo_carro || !cor_carro || !placa) {
        return res.redirect("/registrar_carona");
    }

    try {
        // Aqui você acessa o ID do usuário da sessão
        const userId = req.user.id;  // Acessando o userId do usuário autenticado

        const motorista = await Motorista.create({ nome_motorista, cnh ,numero_telefone});
        const veiculo = await Veiculo.create({ tipo_carro, modelo_veiculo, cor_carro, placa });

        await Carona.create({
            origem,
            destino,
            data,
            hora,
            numero_passageiros,
            motoristaId: motorista.id,
            veiculoId: veiculo.id,
            userId: userId // Agora você passa o userId corretamente
        });

        res.redirect("/caronas_oferecidas");
    } catch (erro) {
        console.error("Erro ao registrar carona:", erro);
        res.redirect("/registrar_carona");
    }
});


app.post("/reservar_carona", ensureAuthenticated, async (req, res) => { 
    const { caronaId } = req.body;

    try {
        // Verifica se já existe uma reserva para a carona pelo usuário
        const existingReservation = await Reserva.findOne({
            where: {
                cadastroId: req.user.id,  // ID do usuário logado
                caronaId: caronaId        // ID da carona que está tentando reservar
            }
        });

        if (existingReservation) {
            // Se já existe, redireciona com uma mensagem de erro
            return res.redirect("/minhas_reservas?error=Você já reservou esta carona.");
        }

        // Busca a carona para verificar as vagas disponíveis
        const carona = await Carona.findOne({ where: { id: caronaId } });

        if (!carona || carona.numero_passageiros <= 0) {
            // Se não houver carona ou não houver mais vagas
            return res.redirect("/caronas-disponiveis?error=Carona indisponível por não ter lugares disponíveis.");
        }

        // Cria a nova reserva
        await Reserva.create({
            cadastroId: req.user.id, // ID do usuário logado
            caronaId: caronaId       // ID da carona reservada
        });

        // Atualiza o número de vagas da carona
        await carona.update({ numero_passageiros: carona.numero_passageiros - 1 });

        // Redireciona para a página de "Minhas Reservas" após a criação da reserva
        res.redirect("/minhas_reservas");

    } catch (erro) {
        console.error("Erro ao reservar carona:", erro);
        res.redirect("/caronas-disponiveis?error=Erro ao reservar a carona.");
    }
});



// Rota para listar reservas do usuário
app.get("/minhas_reservas", ensureAuthenticated, async (req, res) => {
    try {
        const reservas = await Reserva.findAll({
            where: { cadastroId: req.user.id },
            include: [{ model: Carona, include: [Motorista, Veiculo] }]
        });

        res.render("minhas_reservas", { reservas });
    } catch (erro) {
        console.error("Erro ao buscar reservas:", erro);
        res.status(500).json({ error: "Erro ao buscar reservas." });
    }

     
});

// Rota para login com Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        req.session.usuario = { id: req.user.id, name: req.user.name }; // Armazena o usuário na sessão
        res.redirect('/pagina_inicial'); // Redireciona para a página inicial
    }
);

// Rota de login
app.post("/login", (req, res) => {
    const { email, senha } = req.body;
    const hashedSenha = md5(senha);
    console.log("Tentativa de login:", { email, hashedSenha });

    Cadastro.findOne({ where: { email, senha: hashedSenha } })
        .then((cadastro) => {
            if (cadastro) {
                req.login(cadastro, (err) => { // Usando req.login para armazenar o usuário
                    if (err) {
                        console.error("Erro ao logar:", err);
                        return res.redirect("/login?error=true");
                    }
                    console.log("Usuário autenticado:", cadastro);
                    res.redirect("/pagina_inicial"); // Redireciona para a página pagina_inicial
                });
            } else {
                console 
                console.log("Usuário não encontrado ou senha incorreta.");
                res.redirect("/login?error=true"); // Adiciona um parâmetro de erro
            }
        })
        .catch((error) => {
            console.error("Erro ao buscar usuário:", error);
            res.redirect("/login?error=true"); // Adiciona um parâmetro de erro
        });
});

// Rota para a página de login
app.get("/login", (req, res) => {
    const error = req.query.error ? true : false; // Verifica se há um parâmetro de erro
    res.render("login", { error }); // Passa a variável de erro para a view
});

// Rota de cadastro
app.get("/cadastrar", (req, res) => {
    res.render("cadastro");
});

// Rota da página inicial
app.get("/pagina_inicial", ensureAuthenticated, (req, res) => {
    res.render("pagina_inicial");
});

// Rota para registrar carona
app.get("/registrar_carona", ensureAuthenticated, (req, res) => {
    res.render("registrar_carona");
});

// Rota para a página pi_2
app.get("/pi_2", ensureAuthenticated, (req, res) => {
    res.render("pi_2", { usuario: req.session.usuario });
});

// Rota de logout
app.get('/logout', ensureAuthenticated, (req, res) => {
    req.logout(err => {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return next(err);
        }
        req.session.usuario = null; // Limpa a sessão do usuário
        res.redirect('/login'); // Redireciona para a página de login
    });
});



app.get('/caronas_oferecidas', ensureAuthenticated, async (req, res) => {
    try {
        // Verifique se a tabela tem o campo correto (userId ou usuarioId)
        const caronas = await Carona.findAll({
            where: {
                userId: req.user.id  // Verifique se 'userId' é a coluna correta
            },
            include: [
                {
                    model: Motorista, // Inclui o modelo de Motorista se necessário
                    attributes: ['id', 'nome_motorista', 'cnh','numero_telefone']
                },
                {
                    model: Veiculo, // Inclui o modelo de Veículo se necessário
                    attributes: ['id', 'tipo_carro', 'modelo_veiculo', 'placa','cor_carro']
                },
                
            ]
        });
    
        res.render('caronas_oferecidas', { caronas });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao carregar as caronas.");
    }
});







app.post('/cancelar_carona/:id', ensureAuthenticated, async (req, res) => {
    const caronaId = req.params.id;

    try {
        // Verifica se existe uma reserva associada ao usuário logado e à carona
        const reserva = await Reserva.findOne({
            where: {
                caronaId: caronaId,
                cadastroId: req.user.id, // ID do usuário logado
            },
        });

        if (!reserva) {
            return res.status(400).json({ error: 'Reserva não encontrada para esta carona.' });
        }

        // Remove a reserva do banco de dados
        await Reserva.destroy({
            where: {
                caronaId: caronaId,
                cadastroId: req.user.id,
            },
        });

        // Busca a carona associada para atualizar o número de passageiros disponíveis
        const carona = await Carona.findOne({
            where: { id: caronaId },
        });

        if (!carona) {
            return res.status(404).json({ error: 'Carona não encontrada.' });
        }

        // Incrementa o número de passageiros disponíveis
        carona.numero_passageiros += 1;
        await carona.save();

        res.status(200).json({
            message: 'Reserva cancelada com sucesso.',
            numeroPassageirosAtualizado: carona.numero_passageiros,
        });
    } catch (error) {
        console.error('Erro ao cancelar a reserva:', error);
        res.status(500).json({ error: 'Erro ao cancelar a reserva. Tente novamente mais tarde.' });
    }
});

app.delete('/excluir_carona/:id', async (req, res) => {
    const caronaId = req.params.id;

    try {
        const carona = await Carona.findByPk(caronaId);  // Encontre a carona no banco de dados

        if (!carona) {
            return res.status(404).json({ error: 'Carona não encontrada.' });
        }

        await carona.destroy();  // Excluir a carona do banco de dados

        return res.status(200).json({ message: 'Carona excluída com sucesso.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao excluir a carona.' });
    }
});








app.get('/api/motoristas/:id', async (req, res) => {
    try {
        const motorista = await Motorista.findByPk(req.params.id);
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }
        res.json({ numero_telefone: motorista.numero_telefone });
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
});

app.get('/api/motoristas/:id', async (req, res) => {
    console.log('Requisição recebida para motorista com ID:', req.params.id);
    try {
        const motorista = await Motorista.findByPk(req.params.id);
        if (!motorista) {
            console.error('Motorista não encontrado.');
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }
        console.log('Número de telefone encontrado:', motorista.numero_telefone);
        res.json({ numero_telefone: motorista.numero_telefone });
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
});

// Inicializa o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});