const axios = require("axios");
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const app = express();
const port = 8080;
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

// get config vars
dotenv.config();

// access config var
process.env.TOKEN_SECRET;

function generateAccessToken(token) {
  return jwt.sign(token, process.env.TOKEN_SECRET, { expiresIn: "1h" });
}

// configuazione corss
app.use(
  cors({
    origin: "http://localhost:5173", // Cambia con il dominio del tuo frontend se necessario
    methods: ["GET", "POST", "PUT", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// test se api funziona
app.get("/", (req, res) => {
  res.send("Sono attivo!");
});

// collegamento al db
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "agenteCommercio",
  port: 3306,
});

// Test della connessione al database al momento dell'avvio
db.connect((err) => {
  if (err) {
    console.error("Errore di connessione al database:", err.message);
  } else {
    console.log("Connesso al database MySQL!");
  }
});

// Middleware per parsare in JSON le richieste
app.use(express.json());

// Middleware per parsare le richieste GET
app.use(express.urlencoded({ extended: true }));

// Registrazione agente tramite post e email come chiave naturale
app.post("/api/newAgent", (req, res) => {
  // Controllo che arrivano i dati
  //console.log(req.body);
  const email = req.body.email;
  const password = req.body.password;
  //console.log(email);
  // Controllo se l'email esiste già e in caso fornisco un messaggio di errore
  const query = `insert into agenteCommercio.agenti(email,password) values ( ?, ?)`;
  db.query(query, [email, password], (err, rows) => {
    //console.log("errore", err);
    if (err) {
      if (
        (err.code === "ER_DUP_ENTRY" && err.code === "ERR_HTTP_HEADERS_SENT") ||
        err.code === "ER_DUP_ENTRY"
      ) {
        return res.status(406).send("Email già utilizzata!");
      }
    } else {
      return res.status(201).send("Account creato con successo!");
    }
  });
});
// Login con autenticazione tramite token
app.post("/api/login", (req, res) => {
  // Quando si effettua il login si ha un codice vaido per 10 minuti valido per le chiamate successive
  // Autenticazione:
  // Estrapolo i dati:
  const email = req.body.email;
  const password = req.body.password;
  // Preparo la query:
  const query = `Select email, idagenti from agenteCommercio.agenti where email = ? AND password = ?`;
  // Genero il token
  token = generateAccessToken({ token: req.body.email });
  // Effettuo l'accesso:
  db.query(query, [email, password], (err, rows) => {
    // Caso di successo rows sarà 1
    if (rows.length != 0) {
      // preparo la variabile di risposta
      const response = {
        email: rows[0].email,
        idagente: rows[0].idagenti,
        token: token,
      };
      // Mando in risposta i dati che serviranno al frontend
      return res.status(200).send(response);
    } else {
      // Caso di errore, ossia di credenziali errate
      //console.log("Credenziali non valide!");
      return res.status(400).send("Credenziali non valide!");
    }
    // per il client: document.cookie = `token=${token}`
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.sendStatus(401);
  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    //console.log(err);
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
// Prova per il jwt token
app.get("/api/prova", authenticateToken, (req, res) => {
  return res.status(200).send("Funziona l'autenticazione");
});

function modificaPassword(email, nuovaPassword, vecchiaPassword, res) {
  const query = `UPDATE agenteCommercio.agenti SET password = ? WHERE email = ?`;
  db.query(query, [nuovaPassword, vecchiaPassword], (err, rows) => {
    if (rows.length !== 0) {
      return res.status(200).send({
        email: email,
        nuovaPassword: nuovaPassword,
        vecchiaPassword: vecchiaPassword,
      });
    } else {
      return res.status(400).send("Dati non corretti!");
    }
  });
}
// Modifica password mantenendo salvata la vechia password
app.put("/api/modifica-password", authenticateToken, (req, res) => {
  //console.log(req.body);
  const email = req.body.email;
  const password = req.body.password;
  const lastPassword = `SELECT password FROM agenteCommercio.agenti where email = ?`;
  // mi salvo l'ultima password messa a db
  db.query(lastPassword, email, (err, rows) => {
    if (rows.length !== 0) {
      const prova = rows[0].password;
      // funzione per la nuova password
      modificaPassword(email, password, prova, res);
    } else {
      return res.status(400).send("Dati non corretti!");
    }
  });
});

app.post("/api/newZone", authenticateToken, async (req, res) => {
  // ricevo: Token, idagente, Cap
  //console.log(req.body);

  const cap = req.body.cap;
  const idagente = req.body.idagente;

  // verifica se idagente e cap sono presenti in zone, in tal caso si ha il messaggio che l'agente è già sul posto
  const query = `Select idagente, cap FROM agenteCommercio.zone WHERE idagente = ? AND cap = ?`;

  db.query(query, [idagente, cap], (err, rows) => {
    if (err) {
      console.log(err);
      res.status(500).send("Errore durante la verifica a database");
    }
    //console.log(rows);
    if (rows && rows.length === 0) {
      const insertquery = `INSERT INTO agenteCommercio.zone (idagente, cap) VALUES (?,?)`;
      db.query(insertquery, [idagente, cap], async (err) => {
        if (err) {
          console.error(err);
          res.status(500).send("Errore durante l'inserimento nel database.");
        }
        // res.status(200).send("Elemento aggiunto con successo!");
      });

      const zonaID =
        "SELECT idzona FROM agenteCommercio.zone WHERE idagente = ? AND cap = ?";
      db.query(zonaID, [idagente, cap], async (err, rows) => {
        if (err) {
          console.log(err);
          res.status(500).send("Errore durante la verifica a database");
        }
        // aggiungere i posti in base alla zona id

        // tovare nome, latitudine, longitudine dalla chiamata api all'indirizzo https://api.zippopotam.us/it/ + cap

        const dati = async (idzona) => {
          try {
            const response = await axios.get(
              "https://api.zippopotam.us/it/" + cap
            );
            const posti = response.data.places;

            for (const posto of posti) {
              const nome = posto["place name"];
              const latitude = posto.latitude;
              const longitude = posto.longitude;

              const insertPlace = `
                        INSERT INTO agenteCommercio.posti(idzona, nome, latitudine, longitudine)
                        VALUES (?, ?, ?, ?)
                    `;
              await new Promise((resolve, reject) => {
                db.query(
                  insertPlace,
                  [idzona, nome, latitude, longitude],
                  (err) => {
                    if (err) return reject(err);
                    resolve();
                  }
                );
              });
            }
            console.log("Posti aggiunti con successo!");
            return true;
          } catch (err) {
            console.error("Errore durante l'operazione:", err);
            return false;
          }
        };

        // Uso della funzione dati
        db.query(zonaID, [idagente, cap], async (err, rows) => {
          if (err) {
            console.error(err);
            res.status(500).send("Errore durante la verifica a database.");
          }

          if (!rows || rows.length === 0) {
            res.status(404).send("Zona non trovata.");
          }

          const idZona = rows[0].idzona;
          const success = await dati(idZona);

          if (!success) {
            res.status(500).send("Errore durante l'elaborazione dei posti.");
          }
          res.status(200).send("Elemento e posti aggiunti con successo!");
        });
      });
    } else {
      return res.status(409).send("L'agente è già presente nella zona.");
    }
  });
});

app.listen(port, () => {
  console.log(`Server in ascolto su ${port}`);
});
