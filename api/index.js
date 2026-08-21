// vercel serverless entry. lazy mongo connection on first call
import{check}from'../src/license.js';
import app from '../src/app.js';
import connect from '../src/db.js';

check();

let connected=false;

export default async function handler(req, res){
  if(!connected) {await connect();connected=true;}
  app(req,res);
}
