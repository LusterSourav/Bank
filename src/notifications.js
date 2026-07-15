import { Resend } from 'resend';

import twilio from 'twilio';
import config from './config.js';


const resend = config.resendKey ? new Resend(config.resendKey) : null;
const twilioClient =config.twilio.accountSid ? twilio(config.twilio.accountSid,config.twilio.authToken) : null;

export async function sendEmailNotification(to, subject,body) {
  if (!resend || !to) return;


  try{
    await resend.emails.send({ from: 'Bank <notifications@bank.app>', to, subject, html: body });
  } catch (e) {
    console.error('email notification failed:',e.message);

  }
}


export async function sendWhatsAppNotification(to,body,templateVars) {
  if (!twilioClient || !to || !config.twilio.whatsAppFrom) return;


  try{
    const msg = {from: `whatsapp:${config.twilio.whatsAppFrom}`, to: `whatsapp:${to}`};
    if (config.twilio.templateSid && templateVars) {
      msg.contentSid=config.twilio.templateSid;

      msg.contentVariables=JSON.stringify(templateVars);


    } else {
      msg.body = body;
    }


    await twilioClient.messages.create(msg);

  } catch (e) {


    console.error('whatsapp notification failed:', e.message);
  }
}
