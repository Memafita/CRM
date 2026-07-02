exports.handler = async (event) => {
  try {
    console.log('Sincronizando prospectos...');
    
    // Lógica de sincronização
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Prospectos sincronizados com sucesso',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};