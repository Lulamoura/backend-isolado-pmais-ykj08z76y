// Hotfix H1 (0.0.193) — migra o usuário Spok (t42g2do6ozjbx0v) do perfil
// admin (idf6ccbbizd7yq7) para o perfil superadministrador (5s3wdrmxvcu6btl).
// Único UPDATE — nenhum outro campo, usuário, perfil, permissão ou binding.
migrate(
  (app) => {
    app
      .db()
      .newQuery(`
    UPDATE users SET perfil_id = '5s3wdrmxvcu6btl' WHERE id = 't42g2do6ozjbx0v'
  `)
      .execute()
  },
  (app) => {
    app
      .db()
      .newQuery(`
    UPDATE users SET perfil_id = 'idf6ccbbizd7yq7' WHERE id = 't42g2do6ozjbx0v'
  `)
      .execute()
  },
)
