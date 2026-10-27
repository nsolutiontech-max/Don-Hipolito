import pg from 'pg';
const { Client } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({ 
  connectionString: 'postgresql://postgres.rceoboibijmwtxmevash:Soljosefina2015.@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require' 
});
async function run() {
  await client.connect();
  const q = async (label, sql) => {
    const r = await client.query(sql);
    console.log(label, JSON.stringify(r.rows));
  };
  await q('productos activos:', "select count(*) as total from productos where activo;");
  await q('categorias:', "select count(*) as total from categorias;");
  await q('responsables:', "select count(*) as total from responsables where activo;");
  await q('usuarios:', "select count(*) as total from usuarios where activo;");
  await q('actividades:', "select count(*) as total from actividades where activo;");
  await q('inventarios:', "select count(*) as total from inventarios;");
  await q('movimientos:', "select count(*) as total from movimientos;");
  await q('pedidos:', "select count(*) as total from pedidos;");
  await client.end();
}
run().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
