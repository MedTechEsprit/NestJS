const http = require('http');

function doReq(opts, data) {
  return new Promise((resolve) => {
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1. Register
  const regData = JSON.stringify({
    nom: 'PatchTest', prenom: 'User',
    email: 'patchtest' + Date.now() + '@test.com',
    motDePasse: 'test123456',
    typeDiabete: 'TYPE_1', groupeSanguin: 'O+'
  });
  const regRes = await doReq({
    hostname: 'localhost', port: 3000,
    path: '/api/auth/register/patient', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(regData) }
  }, regData);
  
  console.log('REGISTER:', regRes.status);
  const regJson = JSON.parse(regRes.body);
  const userId = regJson.user._id;
  const token = regJson.accessToken;
  console.log('USER ID:', userId);

  // 2. PATCH medical profile (same payload as Flutter form)
  const patchData = JSON.stringify({
    taille: 175, poids: 70,
    profilMedicalComplete: true,
    prendInsuline: false,
    utiliseCapteurGlucose: false,
    antecedentsFamiliauxDiabete: false,
    hypertension: false,
    maladiesCardiovasculaires: false,
    problemesRenaux: false,
    problemesOculaires: false,
    neuropathieDiabetique: false,
    piedDiabetique: false,
    ulceres: false,
    hypoglycemiesFrequentes: false,
    hyperglycemiesFrequentes: false,
    hospitalisationsRecentes: false
  });
  
  const patchRes = await doReq({
    hostname: 'localhost', port: 3000,
    path: '/api/patients/' + userId, method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchData),
      'Authorization': 'Bearer ' + token
    }
  }, patchData);
  
  console.log('PATCH:', patchRes.status);
  console.log('PATCH BODY:', patchRes.body.substring(0, 500));
  process.exit();
})();
