const config = require('../../config');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(config.SENDGRID_API_KEY);

/**
 * As a broker I want to send an agent an invite email

 A sendgrid message object is instantiated and sent to the agent.

 Loading and Errors are handled for UX

 * @param  {string} email email address of Agent
 * @param  {string} brokerage username of Brokerage that is inviting the Agent
 * @param  {string} password password generated for the Agent
 * @param  {string} brokerageEmail email address of the Brokerage
 */

Parse.Cloud.define('sendEmailInvite', (req, res) => {
  const msg = {
    to: req.params.email,
    from: 'no-reply@hopscript.com',
    subject: 'Temporary Password',
    text: `You’ve been invited to use Hopscript by ${req.params.brokerage}, to get started, follow this link https://www.hopscriptagent.com/. Login with this email address and your temporary password: ${req.params.password}. To access your account. If you have questions about why you received this email, please contact ${req.params.brokerageEmail}`
  };
  sgMail.send(msg);
  return res.success("email sent");
});

/**
 * As a broker I want to remove an Agent from my Brokerage
 *
 * We query the database for Users, using the Agent's id
 * If found, the Agent is removed from the database
 * Removing the Agent will trigger an afterDelete to be called
 * Loading and Errors are handled for UX

 * @param  {string} agentId the Agent's parse Id
 */
Parse.Cloud.define('removeAgent', (req, res) => {
  const query = new Parse.Query(Parse.User);
  query.get(req.params.agentId, { useMasterKey: true })
    .then((agent) => {
      if (!agent) { return res.error(`User with agentId ${req.params.agentId} does not exist`); }
      return agent.destroy({ useMasterKey: true });
    })
    .then(obj => res.success(obj))
    .catch(err => res.error(err));
});
