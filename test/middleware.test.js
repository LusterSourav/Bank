import{describe,it,expect,vi}from 'vitest';
import{errorHandler}from '../src/middleware.js';

function fakeReq(){return{};}
function fakeRes(){
  const res={statusCode:0,json:vi.fn()};
  res.status=(c)=>{res.statusCode=c;return res;};
  return res;
}

describe('errorHandler',()=>{
  it('returns 500 for unknown errors',()=>{
    const err=new Error('boom');
    const res=fakeRes();
    errorHandler(err,fakeReq(),res,()=>{});
    expect(res.statusCode).toBe(500);
    expect(res.json).toHaveBeenCalledWith({error:'internal server error'});
  });

  it('uses err.status when set',()=>{
    const err=new Error('not found');
    err.status=404;
    const res=fakeRes();
    errorHandler(err,fakeReq(),res,()=>{});
    expect(res.statusCode).toBe(404);
  });
});
