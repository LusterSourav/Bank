import{describe,it,expect,vi,beforeEach}from 'vitest';
import request from 'supertest';

// bypass firebase auth in tests
process.env.TEST_BYPASS='1';
process.env.TEST_USER_ID='test-user-123';

// mock firebase-admin so it doesn't actually init
vi.mock('firebase-admin',()=>{
  const app={};app.name='[DEFAULT]';app.options={};app.auth=()=>({verifyIdToken:async()=>({uid:'test',email:'test@test.com'})});
  return{default:{apps:[],initializeApp:vi.fn(()=>app),credential:{cert:vi.fn()}}};
});

// mock models with thin fakes
const fakeUser={_id:'u1',id:'u1',firebaseUid:'test-user-123',email:'test@test.com',balance:10000,sendLimit:100000,name:'Test',kyc:{status:'none'},notifyWhatsApp:false,phone:'',totpEnabled:false,webauthnCredentials:[],lastIp:'',save:vi.fn(),toObject(){return this;}};
const User={findOne:vi.fn(),findOneAndUpdate:vi.fn(),updateOne:vi.fn(),create:vi.fn(),deleteOne:vi.fn(),findByIdAndUpdate:vi.fn()};
const emptyQuery={sort:vi.fn(async()=>[])};
const Transaction={find:vi.fn(()=>({sort:()=>({limit:vi.fn(async()=>[])})})),findOne:vi.fn(),create:vi.fn(),aggregate:vi.fn(async()=>[]),deleteMany:vi.fn()};
const Beneficiary={find:vi.fn(()=>emptyQuery),countDocuments:vi.fn(async()=>0),create:vi.fn()};
const Escrow={find:vi.fn(()=>({sort:()=>({limit:vi.fn(async()=>[])})}))};
const Notification={find:vi.fn(()=>({sort:()=>({limit:()=>({lean:vi.fn(async()=>[])})})}))};

vi.mock('../src/models.js',()=>({User,Transaction,Beneficiary,Escrow}));
vi.mock('../src/models/notification.js',()=>({Notification}));
vi.mock('../src/logger.js',()=>({default:{error:vi.fn(),info:vi.fn(),warn:vi.fn()}}));
vi.mock('../src/sanctions.js',()=>({default:vi.fn(()=>false)}));
vi.mock('../src/suspicious.js',()=>({default:vi.fn(async()=>({}))}));
vi.mock('../src/notifications.js',()=>({sendEmailNotification:vi.fn(),sendWhatsAppNotification:vi.fn()}));
vi.mock('../src/validate.js',()=>({validate:()=>(req,res,next)=>next(),schemas:{}}));
vi.mock('../src/config.js',()=>({default:{stripeKey:'sk_test',razorpay:{keyId:'rzp_test',keySecret:'rzp_secret',webhookSecret:'whsec'},stripeWebhookSecret:'whsec',polygonRpcUrl:'https://rpc',oracleProxyAddress:'0x0',eurUsdFeed:'0x0',tokens:{usdc:true}}}));

// patch mongoose connection for health check
const mongoose=await import('mongoose');
mongoose.default.connection.readyState=1;

// import app after mocks
const{default:app}=await import('../src/app.js');

beforeEach(()=>{vi.clearAllMocks();});

describe('GET /api/health',()=>{
  it('returns ok status',async()=>{
    const res=await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBeDefined();
  });
});

describe('POST /api/auth/verify',()=>{
  it('creates and returns user',async()=>{
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({...fakeUser,save:vi.fn(),createdAt:new Date()});
    const res=await request(app).post('/api/auth/verify');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeDefined();
    expect(User.create).toHaveBeenCalled();
  });

  it('returns existing user',async()=>{
    User.findOne.mockResolvedValue(fakeUser);
    const res=await request(app).post('/api/auth/verify');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@test.com');
  });
});

describe('POST /api/send',()=>{
  beforeEach(()=>{
    User.findOne.mockResolvedValue({...fakeUser,balance:10000});
    User.findOneAndUpdate.mockResolvedValue({...fakeUser,balance:9000});
    Transaction.create.mockResolvedValue({id:'tx1',status:'processing'});
  });

  it('deducts balance and returns tx',async()=>{
    const res=await request(app).post('/api/send').send({amount:1000,recipient:'0xABCDEF'});
    expect(res.status).toBe(200);
    expect(res.body.txId).toBe('tx1');
    expect(res.body.balance).toBe(9000);
  });

  it('rejects zero amount',async()=>{
    const res=await request(app).post('/api/send').send({amount:0,recipient:'0xABCDEF'});
    expect(res.status).toBe(400);
  });

  it('rejects missing recipient',async()=>{
    const res=await request(app).post('/api/send').send({amount:100});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/beneficiaries',()=>{
  it('returns empty list for new user',async()=>{
    User.findOne.mockResolvedValue(fakeUser);
    Beneficiary.find.mockReturnValue({sort:vi.fn(async()=>[])});
    const res=await request(app).get('/api/beneficiaries');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/transactions',()=>{
  it('returns empty list for new user',async()=>{
    User.findOne.mockResolvedValue(fakeUser);
    Transaction.find.mockReturnValue({sort:()=>({limit:vi.fn(async()=>[])})});
    const res=await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/notifications/prefs',()=>{
  it('returns notification prefs',async()=>{
    User.findOne.mockResolvedValue(fakeUser);
    const res=await request(app).get('/api/notifications/prefs');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@test.com');
  });
});
