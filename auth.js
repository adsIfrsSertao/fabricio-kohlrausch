const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Cadastro } = require('./database/Cadastro'); // Seu modelo de Cadastro

// Configuração da estratégia do Google
passport.use(new GoogleStrategy({
    clientID: '806942892493-mok1bo80h7t920vp50ecc8v0tlnackb0.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Verifica se o usuário já existe no banco
      let user = await Cadastro.findOne({ where: { email: profile.emails[0].value } });

      // Se o usuário não existir, cria um novo registro
      if (!user) {
        user = await Cadastro.create({
          nome: profile.displayName,
          email: profile.emails[0].value,
          senha: '',  // Senha pode ser deixada em branco
          cpf: '',  // O CPF pode ser deixado em branco se não for obrigatório
          data_nascimento: null
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Serialização e desserialização do usuário
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await Cadastro.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
