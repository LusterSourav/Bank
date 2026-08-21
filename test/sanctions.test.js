import{describe,it,expect}from 'vitest';
import{isSanctioned}from '../src/sanctions.js';

describe('isSanctioned',()=>{
  it('flags known sanctioned address',()=>{
    expect(isSanctioned('0x8589427373D6D84E98730D7795D8f6f8731FDA16')).toBe(true);
    expect(isSanctioned('0x098B716B8Aaf21512996dC57EB0615e2383E2f96')).toBe(true);
    expect(isSanctioned('0xAe36713E740156d411d8e52036a48A6bA8d7d08B')).toBe(true);
  });

  it('flags lowercase variant',()=>{
    expect(isSanctioned('0x8589427373d6d84e98730d7795d8f6f8731fda16')).toBe(true);
  });

  it('rejects clean address',()=>{
    expect(isSanctioned('0x0000000000000000000000000000000000000001')).toBe(false);
  });

  it('handles empty and falsy',()=>{
    expect(isSanctioned('')).toBe(false);
    expect(isSanctioned(null)).toBe(false);
    expect(isSanctioned(undefined)).toBe(false);
  });
});
