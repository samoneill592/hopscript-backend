const { fetchUser } = require('../main');
const { fetchLeadGroup, reconcileLeadGroupToLead } = require('./leadgroups');

/**
 * As an agent I want to create a Lead.
 *
 * We take in a lead object and the user object off of the request object.
 *
 * We run _fetchLeadGroup, giving it the leadGroup off of the lead object.
 *
 * Then we run _createNewLead, giving it the user, the lead, and the leadGroup.
 * This creates the leadGroup object, sets the name, email, phone, leadType, leadGroup, and agent.
 * Then we save the new lead.
 *
 * We take the new lead and run _reconcileLeadToLeadGroup, adding the lead as a pointer on the leadGroup.
 * We save the leadGroup.
 *
 * We then fetch the user and run _reconcicleLeadToUser, passing it the user and the newly saved lead.
 * This sets the lead as a pointer on the User object, and saves the user object.
 *
 * We then send the success message. Loading and Errors are handled for UX.
 *
 *  @param  {object} lead An object representing the lead, including a name, phone, email, leadType, and leadGroup
 *
 */

Parse.Cloud.define('createLeadFromCSV', (req, res) => {
  const { leadCSV } = req.params;
  const { leadGroup } = req.params;
  if (leadGroup) {
    fetchLeadGroup(leadGroup).then((fetchedLeadGroup) => {
      Promise.all(leadCSV.map(lead => _createNewLead(req.user, lead, fetchedLeadGroup)))
        .then((newLeads) => {
          if (leadGroup) { Promise.all(newLeads.map(newlySavedLead => reconcileLeadToLeadGroup(newlySavedLead, leadGroup))).then(g => console.log(g)).catch(e => console.log(e)); }
          res.success("good");
        })
        .catch((err) => {
          console.log("bad", err);
          res.error(err);
        });
    });
  } else {
    Promise.all(leadCSV.map(lead => _createNewLead(req.user, lead)))
      .then((newLeads) => {
        if (leadGroup) { Promise.all(newLeads.map(newlySavedLead => reconcileLeadToLeadGroup(newlySavedLead, leadGroup))).then(g => console.log(g)).catch(e => console.log(e)); }
        res.success("good");
      })
      .catch((err) => {
        console.log("bad", err);
        res.error(err);
      });
  }
});


// creates new lead object
function _createNewLead(user, lead, leadGroup) {
  const Agent = user;
  const LObj = new Parse.Object('Lead');
  const formattedPhone = `+1-${lead.phone}`;
  LObj.set('name', lead.name);
  LObj.set('phone', formattedPhone);
  LObj.set('email', lead.email);
  if (lead.leadType) {
    LObj.set('leadType', lead.leadType);
  }
  if (leadGroup) { LObj.addUnique('leadGroups', leadGroup); }
  LObj.set('agent', Agent);
  return LObj.save();
}

// adds a lead to a leadgroup object
const reconcileLeadToLeadGroup = (lead, leadGroup) => new Promise((resolve) => {
  fetchLeadGroup(leadGroup).then((fetchedLeadGroup) => {
    fetchedLeadGroup.addUnique("leads", lead);
    resolve(fetchedLeadGroup.save());
  });
});

// adds a lead to a user object
function _reconcileLeadToUser(user, lead) {
  return new Promise((resolve) => {
    user.addUnique('leads', lead);
    resolve(user.save(null, { useMasterKey: true }));
  });
}

Parse.Cloud.define('createLeadInLeadGroup', (req, res) => {
  const { lead } = req.params;
  fetchLeadGroup(lead.leadGroup)
    .then((leadGroup) => {
      _createNewLead(req.user, lead, leadGroup)
        .then((newlySavedLead) => {
          reconcileLeadToLeadGroup(newlySavedLead, leadGroup.id)
            .then(() => {
              fetchUser(req.user.id)
                .then((user) => {
                  _reconcileLeadToUser(user, newlySavedLead)
                    .then(r => res.success(r))
                    .catch((reconcileLeadToUserErr) => {
                      res.error(reconcileLeadToUserErr);
                    });
                })
                .catch((fetchUserErr) => {
                  res.error(fetchUserErr);
                });
            })
            .catch((reconcileLeadToLeadGroupErr) => {
              res.error(reconcileLeadToLeadGroupErr);
            });
        })
        .catch((createNewLeadErr) => {
          res.error(createNewLeadErr);
        });
    })
    .catch((fetchLeadGroupErr) => {
      res.error(fetchLeadGroupErr);
    });
});

Parse.Cloud.define('createLead', (req, res) => {
  const { lead } = req.params;
  if (lead.leadGroup) {
    fetchLeadGroup(lead.leadGroup)
      .then((leadGroup) => {
        _createNewLead(req.user, lead, leadGroup)
          .then((newlySavedLead) => {
            reconcileLeadToLeadGroup(newlySavedLead, leadGroup.id);
            fetchUser(req.user.id)
              .then((user) => {
                _reconcileLeadToUser(user, newlySavedLead)
                  .then(r => res.success(r))
                  .catch((reconcileLeadToUserErr) => {
                    console.log('RECONCILE LEAD TO USER ERR: ', reconcileLeadToUserErr);
                    res.error('RECONCILE LEAD TO USER ERR: ', reconcileLeadToUserErr);
                  });
              })
              .catch((fetchUserErr) => {
                console.log('FETCH USER ERR: ', fetchUserErr);
                res.error('FETCH USER ERR: ', fetchUserErr);
              });
          })
          .catch((createNewLeadErr) => {
            console.log('CREATE NEW LEAD ERR: ', createNewLeadErr);
            res.error('CREATE NEW LEAD ERR: ', createNewLeadErr);
          });
      });
  } else {
    _createNewLead(req.user, lead)
      .then((newlySavedLead) => {
        fetchUser(req.user.id)
          .then((user) => {
            _reconcileLeadToUser(user, newlySavedLead)
              .then(r => res.success(r))
              .catch((reconcileLeadToUserErr) => {
                console.log('RECONCILE LEAD TO USER ERR: ', reconcileLeadToUserErr);
                res.error('RECONCILE LEAD TO USER ERR: ', reconcileLeadToUserErr);
              });
          })
          .catch((fetchUserErr) => {
            console.log('FETCH USER ERR: ', fetchUserErr);
            res.error('FETCH USER ERR: ', fetchUserErr);
          });
      })
      .catch((createNewLeadErr) => {
        console.log('CREATE NEW LEAD ERR: ', createNewLeadErr);
        res.error('CREATE NEW LEAD ERR: ', createNewLeadErr);
      });
  }
});

/**
 * As an agent I want to fetch a Lead
 *
 * We query the database for Lead
 * If found, we return the Lead & its associated leadGroups.
 *
 * @param  {object} lead An object representing the lead, including an id, name, phone, email, leadType, and leadGroup
 *
 */

// fetches a lead & the leadgroups associated with it
const _fetchLead = (leadId) => {
  const leadQuery = new Parse.Query('Lead');
  leadQuery.include('leadGroups');
  return leadQuery.get(leadId);
};


Parse.Cloud.define('fetchLead', (req, res) => {
  _fetchLead(req.params.lead)
    .then(lead => res.success(lead))
    .catch(err => res.error(err));
});

/**
 * As an agent I want to fetch my Leads
 * We query the database for Leads, checking to see if the lead's Agent is equal to the user making the query.
 * If found, we return the Leads.
 *
 *@param  {object} user An object representing the user, including their leads
 *
 */

// fetches all leads associated with the user querying
const fetchLeads = user => new Promise((resolve) => {
  const leadQuery = new Parse.Query("Lead");
  leadQuery.equalTo('agent', user).limit(50);
  resolve(leadQuery.find(null, { userMasterKey: true }));
});

Parse.Cloud.define('fetchLeads', (req, res) => {
  fetchLeads(req.user)
    .then(leads => res.success(leads))
    .catch((err) => {
      res.error(err);
    });
});

const fetchNextLeads = (user, skip) => new Promise((resolve) => {
  const leadQuery = new Parse.Query("Lead");
  const skipNumber = skip || 50;
  leadQuery.equalTo('agent', user).skip(skipNumber).limit(50);
  resolve(leadQuery.find(null, { userMasterKey: true }));
});


Parse.Cloud.define('fetchNextLeads', (req, res) => {
  fetchNextLeads(req.user, req.params.skip)
    .then(leads => res.success(leads))
    .catch((err) => {
      res.error(err);
    });
});


function _searchSingleString(searchItem) {
  const leadQuery = new Parse.Query('Lead');
  leadQuery.matches('name', searchItem, "i");
  return leadQuery;
}

Parse.Cloud.define('searchForLeads', (req, res) => {
  if (!req.params.searchStr) { return res.error('search String Required'); }
  if (req.params.searchStr.length === 0) { return res.error('search String Required'); }
  const queryArray = [];
  req.params.searchStr
    .toLowerCase()
    .split(' ')
    .forEach((searchItem) => {
      queryArray.push(_searchSingleString(searchItem));
    });
  Parse.Query
    .and(...queryArray)
    .limit(50)
    .find()
    .then(r => res.success(r))
    .catch((err) => {
      console.log('SEARCH ACTIVE CAMPAIGNS ERR: ', err);
      res.error(err);
    });
});
/**
 * As an agent I want to update a Lead
 *
 * First we use _fetchLead to fetch the lead we want to update.
 *
 * Then we run _updateLead on the lead. This will check to see what is being modified.
 * If it is a leadgroup, we run _reconcileLeadToLeadGroup, which adds the lead as a pointer on the leadGroup,
 * and then saves the leadGroup. Then we run _reconcileLeadGroupTolead, which adds the leadGroup as a pointer on
 * the lead and saves the lead.
 *
 * If what is being modified isn't a leadGroup, _updateLead sets the lead with the updated item.
 *
 * We then send the success message. Loading and Errors are handled for UX.
 *
 * @param  {object} lead An object representing the lead, including an id, name, phone, email, leadType, and leadGroup
 */


// updates the lead
function _updateLead(lead, data) {
  return new Promise((resolve) => {
    Object.keys(data).forEach((key) => {
      if (key === 'leadGroup') {
        reconcileLeadToLeadGroup(lead, data.leadGroup)
          .then(() => reconcileLeadGroupToLead(lead, data.leadGroup));
      } else if (key === 'phone') {
        const formattedPhone = `+1-${data.phone}`;
        lead.set(key, formattedPhone);
      } else if (key !== 'lead') {
        lead.set(key, data[key]);
      }
    });
    resolve(lead.save());
  });
}


Parse.Cloud.define('updateLead', (req, res) => {
  _fetchLead(req.params.lead)
    .then((lead) => {
      _updateLead(lead, req.params)
        .then((r) => {
          res.success(r);
        })
        .catch(updateLeadErr => res.error(updateLeadErr));
    })
    .catch(fetchLeadErr => res.error(fetchLeadErr));
});

/**
 * As an agent I want to remove a LeadGroup from a Lead
 *
 * We fetch the Lead, and then we fetch the LeadGroup.
 *
 * We run _removeLeadFromLeadGroup, removing the lead from the array of lead pointers on the leadGroup.
 * We save the leadGroup.
 *
 * We run _removeLeadGroupFromLead, removing the leadGroup from the array of leadGroup pointers on the lead.
 * We save the lead.
 *
 * We then send the success message. Loading and Errors are handled for UX.
 *
 * @param  {object} lead An object representing the lead, including an id, name, phone, email, leadType, and leadGroup
 *
 */

// removes a lead from a leadgroup
function _removeLeadFromLeadGroup(lead, leadGroup) {
  return new Promise((resolve) => {
    leadGroup.remove("leads", lead);
    resolve(leadGroup.save());
  });
}

// removes a leadgroup from a lead
const removeLeadGroupFromLead = (lead, leadGroup) => new Promise((resolve) => {
  lead.remove("leadGroups", leadGroup);
  resolve(lead.save());
});


Parse.Cloud.define('removeGroupFromLead', (req, res) => {
  _fetchLead(req.params.lead)
    .then((lead) => {
      fetchLeadGroup(req.params.leadGroup)
        .then((leadGroup) => {
          _removeLeadFromLeadGroup(lead, leadGroup)
            .then(() => removeLeadGroupFromLead(lead, leadGroup)
              .then((r) => {
                res.success(r);
              }))
            .catch((removeError) => {
              console.log('REMOVE ERR:', removeError);
              res.error(removeError);
            });
        }).catch((fetchLeadGroupErr) => {
          console.log('FETCH LG ERR', fetchLeadGroupErr);
          res.error(fetchLeadGroupErr);
        });
    })
    .catch((fetchLeadErr) => {
      console.log('FETCH LEAD ERR', fetchLeadErr);
      res.error(fetchLeadErr);
    });
});


/**
 * As an agent I want to delete a Lead.
 * We fetch the Lead.
 *
 * We then run _removeLeadFromGroups, querying for the leadgroups the lead is in and removing
 * it from each leadgroups' array of lead pointers and saving the leadgroups.
 *
 * We then delete the lead.
 *
 * We then run _removeLeadFromAgent, removing the lead from the Agent's array of lead pointers and saving the agent.
 *
 * We then send the success message. Loading and Errors are handled for UX.
 *
 * @param  {object} lead An object representing the lead, including an id, name, phone, email, leadType, and leadGroup
 *
 */

// fetches all the leadgroups associated with a lead
function _fetchLeadGroupsOnLead(lead) {
  return new Promise((resolve) => {
    const leadGroupQuery = new Parse.Query('LeadGroup');
    leadGroupQuery.equalTo("leads", lead);
    resolve(leadGroupQuery.find());
  });
}

// removes a lead from all groups its associated with
function _removeLeadFromGroups(lead) {
  return new Promise((resolve) => {
    _fetchLeadGroupsOnLead(lead)
      .then((groups) => {
        groups.forEach((leadGroup) => {
          _removeLeadFromLeadGroup(lead, leadGroup);
        });
      });
    resolve();
  });
}

// removes a lead from an agent
function _removeLeadFromAgent(lead, user) {
  return new Promise((resolve) => {
    user.remove('leads', lead);
    resolve(user.save(null, { useMasterKey: true }));
  });
}

// deletes a lead
function _deleteLead(lead) {
  return new Promise((resolve) => {
    resolve(lead.destroy());
  });
}


Parse.Cloud.define('deleteLead', (req, res) => {
  _fetchLead(req.params.lead)
    .then((lead) => {
      if (!lead) { return res.error(`Lead with ID ${req.params.lead} does not exist`); }
      _removeLeadFromGroups(lead)
        .then(() => {
          _deleteLead(lead)
            .then(() => {
              _removeLeadFromAgent(lead, req.user)
                .then((r) => {
                  res.success(r);
                }).catch(removeLeadFromAgentErr => res.error(removeLeadFromAgentErr));
            }).catch(deleteLeadErr => res.error(deleteLeadErr));
        }).catch(removeLeadFromLeadGroupErr => res.error(removeLeadFromLeadGroupErr));
    }).catch(fetchLeadErr => res.error(fetchLeadErr));
});


module.exports = {
  _fetchLead,
  fetchLeads,
  reconcileLeadToLeadGroup,
  removeLeadGroupFromLead
};
