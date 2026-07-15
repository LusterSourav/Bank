//in-memory velocity store. swap to redis for prod if needed.

class MemoryStore{


  constructor(){
    this.data= new Map();


    //purge stale entries every 5min
    this._interval =setInterval(()=> this._cleanup(), 300000);
    if (this._interval.unref)this._interval.unref();
  }

  _cleanup() {




    const now= Date.now();
    for (const [key,entries] of this.data) {
      this.data.set(key,entries.filter(e => now - e.time < e.ttl));
      if (this.data.get(key).length === 0) this.data.delete(key);


    }
  }



  append(key, value,ttl=86400000) {
    if (!this.data.has(key))this.data.set(key,[]);




    this.data.get(key).push({value, time: Date.now(),ttl });
  }

  count(key,windowMs) {
    const now =Date.now();


    const entries =this.data.get(key)||[];




    return entries.filter(e => now - e.time < windowMs).length;
  }

  delete(key){




    this.data.delete(key);


  }




}

const store=new MemoryStore();
export default store;
