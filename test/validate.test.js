import{describe,it,expect,vi}from 'vitest';
import{validate,schemas}from '../src/validate.js';

function fakeReq(body={},params={},query={}){return{body,params,params,query};}
function fakeRes(){
  const res={statusCode:0,json:vi.fn()};
  res.status=(c)=>{res.statusCode=c;return res;};
  return res;
}

describe('validate middleware',()=>{
  it('passes valid body',()=>{
    const mw=validate(schemas.send);
    const req=fakeReq({amount:100,recipient:'0x0000000000000000000000000000000000000001'});
    const res=fakeRes();
    const next=vi.fn();
    mw(req,res,next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it('rejects missing required field',()=>{
    const mw=validate(schemas.send);
    const req=fakeReq({amount:100});
    const res=fakeRes();
    const next=vi.fn();
    mw(req,res,next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('rejects negative amount',()=>{
    const mw=validate(schemas.upiCollect);
    const req=fakeReq({amount:-50});
    const res=fakeRes();
    mw(req,res,()=>{});
    expect(res.statusCode).toBe(400);
  });

  it('rejects sendLimit below 500',()=>{
    const mw=validate(schemas.sendLimit);
    const req=fakeReq({sendLimit:100});
    const res=fakeRes();
    mw(req,res,()=>{});
    expect(res.statusCode).toBe(400);
  });

  it('rejects sendLimit above 500000',()=>{
    const mw=validate(schemas.sendLimit);
    const req=fakeReq({sendLimit:999999});
    const res=fakeRes();
    mw(req,res,()=>{});
    expect(res.statusCode).toBe(400);
  });

  it('passes valid sendLimit',()=>{
    const mw=validate(schemas.sendLimit);
    const req=fakeReq({sendLimit:50000});
    const res=fakeRes();
    const next=vi.fn();
    mw(req,res,next);
    expect(next).toHaveBeenCalled();
  });

  it('validates params too',()=>{
    const mw=validate(schemas.orderStatus);
    const req=fakeReq({},{orderId:''});
    const res=fakeRes();
    mw(req,res,()=>{});
    expect(res.statusCode).toBe(400);
  });
});
