/**
 * Adobe Errors Parser & JIRA Automation - Google Apps Script
 * ===========================================================
 * 
 * This script processes Adobe error data from the "Errors" sheet and:
 * 1. Clubs errors per tenant value
 * 2. Creates unique records per company, tenant, customer id, subscription id and error category
 * 3. Creates JIRA tickets separately per error category and for each tenant
 * 4. Provides configurable JIRA ticket creation with category-specific settings
 * 
 * Requirements: Data must be in a sheet named "Errors"
 * Main function: processCsvAndCreateJiraTickets()
 */

// JIRA Configuration - Update these with your JIRA details
const JIRA_CONFIG = {
  baseUrl: 'https://appdirect.jira.com/',
  username: 'ketan.mulay@appdirect.com',
  apiToken: '', // Generate from JIRA Account Settings
  projectKey: 'TCON', // Your JIRA project key
  issueType: 'TC Task' // Issue type for error tickets
};

// Tenant-based Assignee Configuration
const TENANT_ASSIGNEE_CONFIG = {
  // SoftChoice tenants
  'SOFTCHOICEUSA': {
    assignee: 'mike.courts@appdirect.com',
    displayName: 'SoftChoice USA Support Team',
    customerProjectKey: 'SOFTC' // External customer project for SoftChoice
  },
  'SOFTCHOICECANADA': {
    assignee: 'mike.courts@appdirect.com',
    displayName: 'SoftChoice Canada Support Team',
    customerProjectKey: 'SOFTC' // External customer project for SoftChoice
  },
  'SOFTCHOICESANDBOXCAD': {
    assignee: 'mike.courts@appdirect.com',
    displayName: 'SoftChoice Sandbox Canada Support',
    customerProjectKey: 'SOFTC' // External customer project for SoftChoice
  },
  'SOFTCHOICESANDBOXUSA': {
    assignee: 'mike.courts@appdirect.com',
    displayName: 'SoftChoice Sandbox USA Support',
    customerProjectKey: 'SOFTC' // External customer project for SoftChoice
  },
  
  // ACP tenants
  'ACP': {
    assignee: 'manoj.mitkari@appdirect.com',
    displayName: 'ACP Support Team',
    customerProjectKey: 'ACP' // External customer project for ACP
  },
  'ACPTIP': {
    assignee: 'manoj.mitkari@appdirect.com',
    displayName: 'ACP TIP Support Team',
    customerProjectKey: 'ACP' // External customer project for ACP
  },
  
  // CANCOM tenants
  'CANCOM': {
    assignee: 'manoj.mitkari@appdirect.com',
    displayName: 'CANCOM Support Team',
    customerProjectKey: 'CAN' // External customer project for CANCOM
  },
  'CANCOMTIP': {
    assignee: 'manoj.mitkari@appdirect.com',
    displayName: 'CANCOM TIP Support Team',
    customerProjectKey: 'CAN' // External customer project for CANCOM
  },
  'CANCOMAUSTRIAPROD': {
    assignee: 'manoj.mitkari@appdirect.com',
    displayName: 'CANCOM Austria Production Support',
    customerProjectKey: 'CAN' // External customer project for CANCOM
  },
  
  // Default assignee for unknown tenants
  'DEFAULT': {
    assignee: 'mike.courts@appdirect.com',
    displayName: 'Default Adobe Support Team',
    customerProjectKey: 'MC' // Default to internal project
  }
};

// Error Category Configuration for JIRA Tickets
const ERROR_CATEGORY_CONFIG = {
  // Global settings
  createJiraTickets: true, // Master flag to enable/disable JIRA ticket creation (disabled by default)
  
  // Per-category configuration
  categories: {
    "1116 - Invalid Customer": {
      createTicket: true,
      nextSteps: [
        "Verify customer existence: Use Adobe Partner Center portal or Adobe APIs to confirm if the customer ID exists under our partner account",
        "If customer NOT found: Execute softcancel operation for ALL Adobe subscriptions associated with this customer ID, then unlink the customer from the company on marketplace",
        "Update documentation: Record the softcancellations and notify partner if necessary"
      ]
    },
    "2136 - Review the renewal settings": {
      createTicket: true,
      nextSteps: [
        "Check renewal settings: Access Adobe Partner Center or Adobe APIs and verify if the customer has auto-renewal enabled for at least one Active or Scheduled subscription",
        "For RENEWAL failures: If this error occurred during a subscription renewal process and the renewal failed, execute softcancel operation on the specific Adobe subscription that failed to renew",
        "For NON-RENEWAL operations: If this error occurred during any other operation (not renewal), enable auto-renewal setting for at least one Active or Scheduled subscription for this Adobe customer",
        "Verify fix: After making changes, test the operation that originally failed to confirm the issue is resolved",
        "Update documentation: Record the renewal settings changes made and notify customer if necessary"
      ]
    },
    "3115 - Invalid Customer or Subscription ID": {
      createTicket: true,
      nextSteps: [
        "Verify customer existence: Use Adobe Partner Center portal or Adobe APIs to confirm if the customer ID exists under our partner account",
        "Verify subscription existence: Check if the specific subscription ID exists and note its current status (Active, Cancelled, Suspended, etc.)",
        "If CUSTOMER not found: Execute softcancel operation for ALL Adobe subscriptions associated with this customer ID, then unlink the customer from the company on marketplace",
        "If SUBSCRIPTION not found OR not Active: Execute softcancel operation on the specific subscription ID mentioned in the error",
        "If BOTH exist and are Active: Investigate data sync issues, API authentication problems, or temporary Adobe service issues that might cause ID validation failures",
        "Test resolution: Retry the original operation that failed to confirm the issue is resolved",
        "Document outcome: Update customer/subscription records with resolution details and any status changes made"
      ]
    },
    "Default": {
      createTicket: false,
      nextSteps: [
        "Investigate root cause for the error category",
        "Review ALL affected customer accounts listed in the table above",
        "Check each specific Company UUID and Subscription ID provided",
        "Implement fix or workaround for the identified accounts",
        "Monitor for recurrence and establish preventive measures"
      ]
    }
  }
};

/**
 * Main function to process CSV and create JIRA tickets
 */
function processCsvAndCreateJiraTickets() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Step 1: Read CSV data from sheet
    const csvData = readCsvData(spreadsheet);
    
    // Step 2: Club errors per tenant
    const clubbedData = clubErrorsPerTenant(csvData);
    
    // Step 3: Create unique records
    const uniqueRecords = createUniqueRecords(csvData);
    
    // Step 4: Create analysis sheets
    createTenantAnalysisSheet(spreadsheet, clubbedData);
    createUniqueRecordsSheet(spreadsheet, uniqueRecords);
    
    // Step 5: Create JIRA tickets
    const jiraResults = createJiraTickets(clubbedData);
    createJiraTicketsSheet(spreadsheet, jiraResults);
    
    // Step 6: Create sheet for events without JIRA tickets
    createNoTicketEventsSheet(spreadsheet, jiraResults, clubbedData);
    
    // Show completion message
    try {
      SpreadsheetApp.getUi().alert(
        'CSV Processing Complete!',
        `✅ Successfully processed CSV data\n` +
        `📊 Tenants analyzed: ${Object.keys(clubbedData).length}\n` +
        `📋 Unique records: ${uniqueRecords.length}\n` +
        `🎫 JIRA tickets created: ${jiraResults.filter(r => r.success).length}\n` +
        `❌ JIRA failures: ${jiraResults.filter(r => !r.success).length}\n` +
        `📝 Events without tickets: ${jiraResults.filter(r => !r.success).length}\n` +
        `👤 Tickets auto-assigned by tenant\n\n` +
        `Check new sheets: Tenant Analysis, Unique Records, JIRA Tickets, No Ticket Events`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiError) {
      console.log('✅ CSV Processing completed successfully');
    }
    
  } catch (error) {
    console.error('❌ Error processing CSV:', error);
    try {
      SpreadsheetApp.getUi().alert('Error', `Processing failed: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiError) {
      throw error;
    }
  }
}

/**
 * Read CSV data from the "Errors" sheet
 */
function readCsvData(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Errors");
  if (!sheet) {
    throw new Error('Sheet named "Errors" not found. Please ensure your data is in a sheet named "Errors".');
  }
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    throw new Error('No data found in the "Errors" sheet. Please ensure the sheet contains data with headers.');
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  // Map CSV data to objects
  const csvData = rows.map(row => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  }).filter(record => {
    // More flexible filtering - check for any tenant/category-like fields
    const hasTenant = record.Tenant || record.tenant || record.TENANT;
    const hasCategory = record.Category || record.category || record.CATEGORY || record.Error || record.error;
    return hasTenant && hasCategory;
  });
  
  return csvData;
}

/**
 * Club errors per tenant value
 */
function clubErrorsPerTenant(csvData) {
  const tenantGroups = {};
  
  csvData.forEach(record => {
    const tenant = record.Tenant;
    const category = record.Category;
    
    if (!tenantGroups[tenant]) {
      tenantGroups[tenant] = {};
    }
    
    if (!tenantGroups[tenant][category]) {
      tenantGroups[tenant][category] = {
        count: 0,
        records: [],
        uniqueCustomers: new Set(),
        uniqueSubscriptions: new Set(),
        firstOccurrence: record.Timestamp,
        lastOccurrence: record.Timestamp
      };
    }
    
    tenantGroups[tenant][category].count++;
    tenantGroups[tenant][category].records.push(record);
    tenantGroups[tenant][category].uniqueCustomers.add(record['Customer ID']);
    tenantGroups[tenant][category].uniqueSubscriptions.add(record['Subscription ID']);
    
    // Update timestamps
    if (record.Timestamp < tenantGroups[tenant][category].firstOccurrence) {
      tenantGroups[tenant][category].firstOccurrence = record.Timestamp;
    }
    if (record.Timestamp > tenantGroups[tenant][category].lastOccurrence) {
      tenantGroups[tenant][category].lastOccurrence = record.Timestamp;
    }
  });
  
  // Convert Sets to counts
  Object.keys(tenantGroups).forEach(tenant => {
    Object.keys(tenantGroups[tenant]).forEach(category => {
      const group = tenantGroups[tenant][category];
      group.uniqueCustomerCount = group.uniqueCustomers.size;
      group.uniqueSubscriptionCount = group.uniqueSubscriptions.size;
      delete group.uniqueCustomers;
      delete group.uniqueSubscriptions;
    });
  });
  
  return tenantGroups;
}

/**
 * Create unique records per company, tenant, customer id, subscription id and error category
 */
function createUniqueRecords(csvData) {
  const uniqueMap = new Map();
  
  csvData.forEach(record => {
    const key = `${record['Company Uuid']}_${record.Tenant}_${record['Customer ID']}_${record['Subscription ID']}_${record.Category}`;
    
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        companyUuid: record['Company Uuid'],
        tenant: record.Tenant,
        customerId: record['Customer ID'],
        subscriptionId: record['Subscription ID'],
        category: record.Category,
        error: record.Error,
        message: record.Message,
        firstOccurrence: record.Timestamp,
        lastOccurrence: record.Timestamp,
        occurrenceCount: 1
      });
    } else {
      const existing = uniqueMap.get(key);
      existing.occurrenceCount++;
      
      // Update timestamps
      if (record.Timestamp < existing.firstOccurrence) {
        existing.firstOccurrence = record.Timestamp;
      }
      if (record.Timestamp > existing.lastOccurrence) {
        existing.lastOccurrence = record.Timestamp;
      }
    }
  });
  
  const uniqueRecords = Array.from(uniqueMap.values());
  return uniqueRecords;
}

/**
 * Create JIRA tickets per error category and tenant
 */
function createJiraTickets(clubbedData) {
  const jiraResults = [];
  
  // Check if JIRA ticket creation is globally enabled
  if (!ERROR_CATEGORY_CONFIG.createJiraTickets) {
    Object.keys(clubbedData).forEach(tenant => {
      Object.keys(clubbedData[tenant]).forEach(category => {
        jiraResults.push({
          tenant: tenant,
          category: category,
          success: false,
          ticketKey: null,
          ticketUrl: null,
          message: 'JIRA ticket creation disabled globally'
        });
      });
    });
    return jiraResults;
  }
  
  Object.keys(clubbedData).forEach(tenant => {
    Object.keys(clubbedData[tenant]).forEach(category => {
      const errorGroup = clubbedData[tenant][category];
      
      // Check if ticket creation is enabled for this category
      const categoryConfig = ERROR_CATEGORY_CONFIG.categories[category] || ERROR_CATEGORY_CONFIG.categories["Default"];
      
      if (!categoryConfig.createTicket) {
        jiraResults.push({
          tenant: tenant,
          category: category,
          success: false,
          ticketKey: null,
          ticketUrl: null,
          message: `JIRA ticket creation disabled for category: ${category}`
        });
        return;
      }
      
      try {
        const ticketData = {
          tenant: tenant,
          category: category,
          count: errorGroup.count,
          uniqueCustomers: errorGroup.uniqueCustomerCount,
          uniqueSubscriptions: errorGroup.uniqueSubscriptionCount,
          firstOccurrence: errorGroup.firstOccurrence,
          lastOccurrence: errorGroup.lastOccurrence
        };
        
        const jiraTicket = createJiraTicket(ticketData);
        const customerTicketInfo = jiraTicket.customerTicket ? 
          ` | Customer: ${jiraTicket.customerTicket.key}` : '';
        
        jiraResults.push({
          tenant: tenant,
          category: category,
          success: true,
          ticketKey: jiraTicket.key,
          ticketUrl: `${JIRA_CONFIG.baseUrl}/browse/${jiraTicket.key}`,
          customerTicketKey: jiraTicket.customerTicket?.key || null,
          customerTicketUrl: jiraTicket.customerTicket ? `${JIRA_CONFIG.baseUrl}/browse/${jiraTicket.customerTicket.key}` : null,
          message: `Internal ticket created successfully${customerTicketInfo}`
        });
        
      } catch (error) {
        console.error(`❌ Failed to create JIRA ticket for ${tenant} - ${category}:`, error);
        jiraResults.push({
          tenant: tenant,
          category: category,
          success: false,
          ticketKey: null,
          ticketUrl: null,
          message: error.message
        });
      }
    });
  });
  
  return jiraResults;
}

/**
 * Create individual JIRA ticket (creates both internal and customer tickets)
 */
function createJiraTicket(ticketData) {
  const summary = `Adobe Error: ${ticketData.category} - ${ticketData.tenant}`;
  
  // Get detailed records for this tenant/category combination
  const detailedRecords = getDetailedRecordsForTicket(ticketData.tenant, ticketData.category);
  
  // Get category-specific configuration for next steps
  const categoryConfig = ERROR_CATEGORY_CONFIG.categories[ticketData.category] || ERROR_CATEGORY_CONFIG.categories["Default"];
  const nextSteps = categoryConfig.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  
  // Get tenant-specific assignee and customer project
  const assigneeConfig = TENANT_ASSIGNEE_CONFIG[ticketData.tenant] || TENANT_ASSIGNEE_CONFIG['DEFAULT'];
  const assigneeEmail = assigneeConfig.assignee;
  const assigneeDisplayName = assigneeConfig.displayName;
  const customerProjectKey = assigneeConfig.customerProjectKey;
  
  const description = `*Adobe Error Report*

*Tenant:* ${ticketData.tenant}
*Error Category:* ${ticketData.category}
*Total Occurrences:* ${ticketData.count}
*Unique Customers Affected:* ${ticketData.uniqueCustomers}
*Unique Subscriptions Affected:* ${ticketData.uniqueSubscriptions}

*Time Range:*
• First Occurrence: ${ticketData.firstOccurrence}
• Last Occurrence: ${ticketData.lastOccurrence}

*Impact Level:* ${getPriority(ticketData.count, ticketData.uniqueCustomers)}

*Affected Accounts Summary:*
${detailedRecords.summary}

*All Affected Customer/Subscription Records:*
${detailedRecords.details}

*Next Steps:*
${nextSteps}

*Assigned to:* ${assigneeDisplayName} (${assigneeEmail})`;

  // Create internal ticket (MC project)
  const internalTicket = createSingleJiraTicket({
    projectKey: JIRA_CONFIG.projectKey,
    summary: `[INTERNAL] ${summary}`,
    description: description,
    assigneeEmail: assigneeEmail,
    labels: ['appconnectors', 'automated', 'internal', `tenant-${ticketData.tenant.toLowerCase()}`]
  });

  // Create customer ticket (tenant-specific project) only if different from internal project
  let customerTicket = null;
  if (customerProjectKey !== JIRA_CONFIG.projectKey) {
    const customerDescription = `*Adobe Error Report - Customer Visibility*

*Tenant:* ${ticketData.tenant}
*Error Category:* ${ticketData.category}
*Total Occurrences:* ${ticketData.count}
*Unique Customers Affected:* ${ticketData.uniqueCustomers}
*Unique Subscriptions Affected:* ${ticketData.uniqueSubscriptions}

*Time Range:*
• First Occurrence: ${ticketData.firstOccurrence}
• Last Occurrence: ${ticketData.lastOccurrence}

*Impact Level:* ${getPriority(ticketData.count, ticketData.uniqueCustomers)}

*Status:* Investigation in progress
*Internal Reference:* ${internalTicket.key}

*Affected Accounts Summary:*
${detailedRecords.summary}

*All Affected Customer/Subscription Records:*
${detailedRecords.details}

*Next Steps:*
${nextSteps}

*Assigned to:* ${assigneeDisplayName} (${assigneeEmail})`;

    customerTicket = createSingleJiraTicket({
      projectKey: customerProjectKey,
      summary: `Adobe Error: ${ticketData.category} - ${ticketData.tenant}`,
      description: customerDescription,
      assigneeEmail: assigneeEmail,
      labels: ['adobe-error', 'customer-visible', `tenant-${ticketData.tenant.toLowerCase()}`]
    });
  }

  // Return primary ticket (internal) with customer ticket reference
  return {
    ...internalTicket,
    customerTicket: customerTicket
  };
}

/**
 * Create a single JIRA ticket with specified parameters
 */
function createSingleJiraTicket(ticketParams) {
  const payload = {
    fields: {
      project: {
        key: ticketParams.projectKey
      },
      summary: ticketParams.summary,
      description: ticketParams.description,
      issuetype: {
        name: JIRA_CONFIG.issueType
      },
      assignee: {
        emailAddress: ticketParams.assigneeEmail
      },
      labels: ticketParams.labels
    }
  };

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Utilities.base64Encode(`${JIRA_CONFIG.username}:${JIRA_CONFIG.apiToken}`)}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(`${JIRA_CONFIG.baseUrl}/rest/api/2/issue`, options);
  
  if (response.getResponseCode() !== 201) {
    const errorDetails = response.getContentText();
    console.error(`JIRA API Error Details:`, errorDetails);
    throw new Error(`JIRA API error: ${response.getResponseCode()} - ${errorDetails}`);
  }

  return JSON.parse(response.getContentText());
}

/**
 * Get detailed records for JIRA ticket
 */
function getDetailedRecordsForTicket(tenant, category) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName("Errors");
    
    if (!sheet) {
      return {
        summary: "No detailed data available - Errors sheet not found",
        details: "Unable to retrieve detailed records",
        topCompany: "Unknown",
        topCustomer: "Unknown", 
        pattern: "Unable to analyze"
      };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        summary: "No data available in Errors sheet",
        details: "Sheet appears to be empty",
        topCompany: "Unknown",
        topCustomer: "Unknown",
        pattern: "Unable to analyze"
      };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find matching records for this tenant/category and create unique records
    const matchingRecords = [];
    const uniqueRecordsMap = new Map();
    const companyCount = {};
    const customerCount = {};
    
    rows.forEach(row => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      
      // Check if this record matches the tenant and category
      const recordTenant = record.Tenant || record.tenant || '';
      const recordCategory = record.Category || record.category || '';
      
      if (recordTenant === tenant && recordCategory === category) {
        matchingRecords.push(record);
        
        // Create unique key for deduplication - check multiple possible column names
        const companyUuid = record['Company Uuid'] || record['CompanyUuid'] || record['Company UUID'] || record['COMPANY_UUID'] || 'Unknown';
        const customerId = record['Customer ID'] || record['CustomerId'] || record['CUSTOMER_ID'] || record['Customer Id'] || 'Unknown';
        const subscriptionId = record['Subscription ID'] || record['SubscriptionId'] || record['SUBSCRIPTION_ID'] || record['Subscription Id'] || 'Unknown';
        const uniqueKey = `${companyUuid}_${customerId}_${subscriptionId}`;
        
        // Store unique records only
        if (!uniqueRecordsMap.has(uniqueKey)) {
          uniqueRecordsMap.set(uniqueKey, {
            companyUuid: companyUuid,
            customerId: customerId,
            subscriptionId: subscriptionId,
            firstTimestamp: record.Timestamp || record.timestamp || 'Unknown',
            lastTimestamp: record.Timestamp || record.timestamp || 'Unknown',
            occurrenceCount: 1,
            error: record.Error || record.error || record.Message || 'Unknown'
          });
        } else {
          // Update existing record with latest timestamp and increment count
          const existing = uniqueRecordsMap.get(uniqueKey);
          existing.occurrenceCount++;
          existing.lastTimestamp = record.Timestamp || record.timestamp || existing.lastTimestamp;
        }
        
        // Count companies and customers
        companyCount[companyUuid] = (companyCount[companyUuid] || 0) + 1;
        customerCount[customerId] = (customerCount[customerId] || 0) + 1;
      }
    });
    
    // Convert unique records map to array
    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    
    // Generate summary
    const uniqueCompanies = Object.keys(companyCount).length;
    const uniqueCustomers = Object.keys(customerCount).length;
    const uniqueSubscriptions = uniqueRecords.length;
    
    const summary = `• ${uniqueCompanies} unique companies affected\n• ${uniqueCustomers} unique customers affected\n• ${uniqueSubscriptions} unique subscriptions affected\n• ${matchingRecords.length} total error occurrences`;
    
    // Generate detailed records table with proper JIRA formatting - ALL records
    let details = "|| Company UUID || Customer ID || Subscription ID || First Occurrence || Last Occurrence || Error Count ||\n";
    
    uniqueRecords.forEach(record => {
      const companyUuid = record.companyUuid || 'Unknown';
      const customerId = record.customerId || 'Unknown';
      const subscriptionId = record.subscriptionId || 'Unknown';
      const firstTimestamp = record.firstTimestamp || 'Unknown';
      const lastTimestamp = record.lastTimestamp || 'Unknown';
      const count = record.occurrenceCount || 1;
      
      details += `| ${companyUuid} | ${customerId} | ${subscriptionId} | ${firstTimestamp} | ${lastTimestamp} | ${count} |\n`;
    });
    
    // Find top affected company and customer
    const topCompany = Object.keys(companyCount).reduce((a, b) => companyCount[a] > companyCount[b] ? a : b, 'Unknown');
    const topCustomer = Object.keys(customerCount).reduce((a, b) => customerCount[a] > customerCount[b] ? a : b, 'Unknown');
    
    // Analyze pattern
    const timestamps = matchingRecords.map(r => r.Timestamp || r.timestamp).filter(t => t && t !== 'Unknown');
    const pattern = timestamps.length > 1 ? 
      `Errors occurred over ${timestamps.length} time points` : 
      'Single occurrence or timestamps unavailable';
    
    return {
      summary: summary,
      details: details,
      topCompany: topCompany.substring(0, 20) + (topCompany.length > 20 ? '...' : ''),
      topCustomer: topCustomer,
      pattern: pattern
    };
    
  } catch (error) {
    console.error('Error generating detailed records:', error);
    return {
      summary: "Error retrieving detailed data: " + error.message,
      details: "Unable to process records due to error",
      topCompany: "Unknown",
      topCustomer: "Unknown",
      pattern: "Unable to analyze"
    };
  }
}

/**
 * Determine priority based on error count and customer impact
 */
function getPriority(count, uniqueCustomers) {
  if (count >= 100 || uniqueCustomers >= 10) return 'High';
  if (count >= 50 || uniqueCustomers >= 5) return 'Medium';
  return 'Low';
}

/**
 * Create Tenant Analysis sheet
 */
function createTenantAnalysisSheet(spreadsheet, clubbedData) {
  let sheet = spreadsheet.getSheetByName("Tenant Analysis");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Tenant Analysis");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = [
    'Tenant', 'Error Category', 'Total Count', 'Unique Customers', 
    'Unique Subscriptions', 'First Occurrence', 'Last Occurrence'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Data rows
  const rows = [];
  Object.keys(clubbedData).forEach(tenant => {
    Object.keys(clubbedData[tenant]).forEach(category => {
      const group = clubbedData[tenant][category];
      rows.push([
        tenant,
        category,
        group.count,
        group.uniqueCustomerCount,
        group.uniqueSubscriptionCount,
        group.firstOccurrence,
        group.lastOccurrence
      ]);
    });
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // Apply alternating row colors
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      sheet.getRange(rowNumber, 1, 1, headers.length).setBackground(backgroundColor);
    });
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setFrozenRows(1);
}

/**
 * Create Unique Records sheet
 */
function createUniqueRecordsSheet(spreadsheet, uniqueRecords) {
  let sheet = spreadsheet.getSheetByName("Unique Records");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Unique Records");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = [
    'Company UUID', 'Tenant', 'Customer ID', 'Subscription ID', 'Error Category',
    'Error', 'Message', 'First Occurrence', 'Last Occurrence', 'Occurrence Count'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#34a853')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Data rows
  if (uniqueRecords.length > 0) {
    const rows = uniqueRecords.map(record => [
      record.companyUuid,
      record.tenant,
      record.customerId,
      record.subscriptionId,
      record.category,
      record.error,
      record.message.length > 100 ? record.message.substring(0, 100) + '...' : record.message,
      record.firstOccurrence,
      record.lastOccurrence,
      record.occurrenceCount
    ]);
    
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // Apply alternating row colors
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      sheet.getRange(rowNumber, 1, 1, headers.length).setBackground(backgroundColor);
    });
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setFrozenRows(1);
}

/**
 * Create No Ticket Events sheet for events that didn't get JIRA tickets
 */
function createNoTicketEventsSheet(spreadsheet, jiraResults, clubbedData) {
  let sheet = spreadsheet.getSheetByName("No Ticket Events");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("No Ticket Events");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = [
    'Tenant', 'Error Category', 'Total Count', 'Unique Customers', 
    'Unique Subscriptions', 'First Occurrence', 'Last Occurrence', 
    'Reason', 'Recommendation'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#ff9800')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Data rows - only include events that didn't get tickets
  const rows = [];
  jiraResults.forEach(result => {
    if (!result.success) {
      const errorGroup = clubbedData[result.tenant][result.category];
      const categoryConfig = ERROR_CATEGORY_CONFIG.categories[result.category] || ERROR_CATEGORY_CONFIG.categories["Default"];
      
      let reason = result.message;
      let recommendation = "Review error category and decide if JIRA ticket is needed";
      
      if (result.message.includes('disabled globally')) {
        reason = "JIRA ticket creation disabled globally";
        recommendation = "Enable ERROR_CATEGORY_CONFIG.createJiraTickets = true if tickets are needed";
      } else if (result.message.includes('disabled for category')) {
        reason = `JIRA ticket creation disabled for this category`;
        recommendation = `Enable createTicket: true for "${result.category}" category if tickets are needed`;
      }
      
      rows.push([
        result.tenant,
        result.category,
        errorGroup.count,
        errorGroup.uniqueCustomerCount,
        errorGroup.uniqueSubscriptionCount,
        errorGroup.firstOccurrence,
        errorGroup.lastOccurrence,
        reason,
        recommendation
      ]);
    }
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // Apply alternating row colors
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const backgroundColor = index % 2 === 0 ? '#fff3e0' : '#ffffff';
      sheet.getRange(rowNumber, 1, 1, headers.length).setBackground(backgroundColor);
    });
  } else {
    // Add a message if no events without tickets
    sheet.getRange(2, 1, 1, headers.length).setValues([
      ['No events found', 'All configured categories had JIRA tickets created', '', '', '', '', '', 'All events processed', 'No action needed']
    ]);
    sheet.getRange(2, 1, 1, headers.length).setBackground('#e8f5e8');
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setFrozenRows(1);
}

/**
 * Create JIRA Tickets sheet
 */
function createJiraTicketsSheet(spreadsheet, jiraResults) {
  let sheet = spreadsheet.getSheetByName("JIRA Tickets");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("JIRA Tickets");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = [
    'Tenant', 'Error Category', 'Status', 'Internal Ticket', 'Internal URL', 'Customer Ticket', 'Customer URL', 'Message'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#ea4335')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Data rows
  if (jiraResults.length > 0) {
    const rows = jiraResults.map(result => [
      result.tenant,
      result.category,
      result.success ? '✅ Success' : '❌ Failed',
      result.ticketKey || 'N/A',
      result.ticketUrl || 'N/A',
      result.customerTicketKey || 'N/A',
      result.customerTicketUrl || 'N/A',
      result.message
    ]);
    
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // Apply conditional formatting for status
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const backgroundColor = row[2].includes('Success') ? '#d4edda' : '#f8d7da';
      sheet.getRange(rowNumber, 3, 1, 1).setBackground(backgroundColor);
    });
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setFrozenRows(1);
}

/**
 * Create menu for easy access
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Adobe Errors Parser')
    .addItem('🚀 Process CSV & Create JIRA Tickets', 'processCsvAndCreateJiraTickets')
    .addSeparator()
    .addItem('📊 View Tenant Analysis', 'openTenantAnalysis')
    .addItem('📋 View Unique Records', 'openUniqueRecords')
    .addItem('🎫 View JIRA Tickets', 'openJiraTickets')
    .addItem('📝 View No Ticket Events', 'openNoTicketEvents')
    .addSeparator()
    .addItem('⚙️ Configure JIRA Settings', 'showJiraConfig')
    .addItem('🔧 Configure Error Categories', 'showErrorCategoryConfig')
    .addItem('👤 Configure Tenant Assignees', 'showTenantAssigneeConfig')
    .addToUi();
}

/**
 * Helper functions to open specific sheets
 */
function openTenantAnalysis() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tenant Analysis");
  if (sheet) sheet.activate();
}

function openUniqueRecords() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Unique Records");
  if (sheet) sheet.activate();
}

function openJiraTickets() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("JIRA Tickets");
  if (sheet) sheet.activate();
}

function openNoTicketEvents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("No Ticket Events");
  if (sheet) sheet.activate();
}

/**
 * Show JIRA configuration dialog
 */
function showJiraConfig() {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h3>JIRA Configuration</h3>
      <p>To enable JIRA ticket creation, update the JIRA_CONFIG object in the script:</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
const JIRA_CONFIG = {
  baseUrl: 'https://your-company.atlassian.net',
  username: 'your-email@company.com',
  apiToken: 'your-jira-api-token',
  projectKey: 'AC',
  issueType: 'Task'
};
      </pre>
      <p><strong>Steps:</strong></p>
      <ol>
        <li>Go to Extensions → Apps Script</li>
        <li>Update the JIRA_CONFIG values</li>
        <li>Save the script</li>
        <li>Generate API token from JIRA Account Settings</li>
      </ol>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'JIRA Configuration');
}

/**
 * Show Error Category configuration dialog
 */
function showErrorCategoryConfig() {
  const currentStatus = ERROR_CATEGORY_CONFIG.createJiraTickets ? 'Enabled' : 'Disabled';
  const categoryCount = Object.keys(ERROR_CATEGORY_CONFIG.categories).length - 1; // Exclude "Default"
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h3>Error Category Configuration</h3>
      <p><strong>Current Status:</strong> JIRA ticket creation is <span style="color: ${ERROR_CATEGORY_CONFIG.createJiraTickets ? 'green' : 'red'};">${currentStatus}</span></p>
      <p><strong>Configured Categories:</strong> ${categoryCount} specific categories + Default fallback</p>
      
      <h4>Global Settings</h4>
      <p>To enable/disable JIRA ticket creation globally, update the ERROR_CATEGORY_CONFIG:</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
ERROR_CATEGORY_CONFIG.createJiraTickets = true; // or false
      </pre>
      
      <h4>Per-Category Configuration</h4>
      <p>Each error category can have individual settings:</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
"1116 - Invalid Customer": {
  createTicket: true,        // Enable/disable for this category
  nextSteps: [              // Custom next steps for this error
    "Verify customer account status",
    "Check customer eligibility",
    "Review onboarding process"
  ]
}
      </pre>
      
      <h4>Available Categories</h4>
      <ul>
        <li>1116 - Invalid Customer</li>
        <li>2136 - Review the renewal settings</li>
        <li>3115 - Invalid Customer or Subscription ID</li>
        <li>Default (fallback for unlisted categories)</li>
      </ul>
      
      <p><strong>To modify:</strong></p>
      <ol>
        <li>Go to Extensions → Apps Script</li>
        <li>Find ERROR_CATEGORY_CONFIG object</li>
        <li>Update global or category-specific settings</li>
        <li>Save the script</li>
      </ol>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(600)
    .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Error Category Configuration');
}

/**
 * Show Tenant Assignee configuration dialog
 */
function showTenantAssigneeConfig() {
  const tenantCount = Object.keys(TENANT_ASSIGNEE_CONFIG).length - 1; // Exclude "DEFAULT"
  
  // Generate tenant list HTML
  let tenantListHtml = '';
  Object.keys(TENANT_ASSIGNEE_CONFIG).forEach(tenant => {
    if (tenant !== 'DEFAULT') {
      const config = TENANT_ASSIGNEE_CONFIG[tenant];
      tenantListHtml += `<li><strong>${tenant}</strong>: ${config.displayName} (${config.assignee}) → Project: ${config.customerProjectKey}</li>`;
    }
  });
  
  const defaultConfig = TENANT_ASSIGNEE_CONFIG['DEFAULT'];
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h3>Tenant Assignee Configuration</h3>
      <p><strong>Configured Tenants:</strong> ${tenantCount} specific tenants + Default fallback</p>
      
      <h4>Current Tenant Assignments</h4>
      <ul style="line-height: 1.6;">
        ${tenantListHtml}
      </ul>
      
      <h4>Default Assignee</h4>
      <p><strong>DEFAULT</strong>: ${defaultConfig.displayName} (${defaultConfig.assignee}) → Project: ${defaultConfig.customerProjectKey}</p>
      
      <h4>How It Works</h4>
      <p>When a JIRA ticket is created, the system creates TWO tickets:</p>
      <ol>
        <li><strong>Internal Ticket</strong>: Created in MC project with detailed technical information</li>
        <li><strong>Customer Ticket</strong>: Created in tenant-specific project for external visibility</li>
        <li>Both tickets assigned to the same person based on tenant configuration</li>
        <li>Customer ticket references internal ticket for tracking</li>
        <li>Falls back to DEFAULT assignee and project for unknown tenants</li>
      </ol>
      
      <h4>To Update Assignees</h4>
      <p>To modify tenant assignees:</p>
      <ol>
        <li>Go to Extensions → Apps Script</li>
        <li>Find TENANT_ASSIGNEE_CONFIG object</li>
        <li>Update the assignee email addresses</li>
        <li>Update displayName if needed</li>
        <li>Save the script</li>
      </ol>
      
      <h4>Example Configuration</h4>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
'SOFTCHOICEUSA': {
  assignee: 'john.doe@company.com',
  displayName: 'John Doe - SoftChoice USA',
  customerProjectKey: 'SC'  // Customer project for external visibility
}
      </pre>
      
      <h4>Project Key Mapping</h4>
      <ul>
        <li><strong>SC</strong>: SoftChoice customer project</li>
        <li><strong>ACP</strong>: ACP customer project</li>
        <li><strong>CAN</strong>: CANCOM customer project</li>
        <li><strong>MC</strong>: Internal project (default)</li>
      </ul>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(650)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Tenant Assignee Configuration');
}
