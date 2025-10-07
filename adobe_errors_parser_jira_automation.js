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
  baseUrl: 'https://your-company.atlassian.net',
  username: 'your-email@company.com',
  apiToken: 'your-jira-api-token', // Generate from JIRA Account Settings
  projectKey: 'AC', // Your JIRA project key
  issueType: 'Task' // Issue type for error tickets
};

// Error Category Configuration for JIRA Tickets
const ERROR_CATEGORY_CONFIG = {
  // Global settings
  createJiraTickets: true, // Master flag to enable/disable JIRA ticket creation
  
  // Per-category configuration
  categories: {
    "1116 - Invalid Customer": {
      createTicket: true,
      nextSteps: [
        "Verify customer account status in Adobe system",
        "Check customer eligibility for the requested product/service",
        "Review customer onboarding process for data accuracy",
        "Update customer records if necessary",
        "Implement validation checks to prevent future occurrences"
      ]
    },
    "2136 - Review the renewal settings": {
      createTicket: true,
      nextSteps: [
        "Review renewal configuration for affected subscriptions",
        "Validate renewal settings against business rules",
        "Check for any recent changes to renewal policies",
        "Update subscription renewal settings as needed",
        "Document proper renewal configuration procedures"
      ]
    },
    "3115 - Invalid Customer or Subscription ID": {
      createTicket: true,
      nextSteps: [
        "Validate customer and subscription ID formats",
        "Check data synchronization between systems",
        "Review ID generation and assignment processes",
        "Implement data validation at entry points",
        "Create monitoring for ID-related errors"
      ]
    },
    "Default": {
      createTicket: true,
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
    
    // Show completion message
    try {
      SpreadsheetApp.getUi().alert(
        'CSV Processing Complete!',
        `✅ Successfully processed CSV data\n` +
        `📊 Tenants analyzed: ${Object.keys(clubbedData).length}\n` +
        `📋 Unique records: ${uniqueRecords.length}\n` +
        `🎫 JIRA tickets created: ${jiraResults.filter(r => r.success).length}\n` +
        `❌ JIRA failures: ${jiraResults.filter(r => !r.success).length}\n\n` +
        `Check new sheets: Tenant Analysis, Unique Records, JIRA Tickets`,
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
  
  console.log(`📋 Found headers in "Errors" sheet:`, headers);
  console.log(`📊 Total rows in "Errors" sheet: ${rows.length}`);
  
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
  
  console.log(`📊 Read ${csvData.length} valid records from "Errors" sheet`);
  if (csvData.length > 0) {
    console.log(`📝 Sample record:`, csvData[0]);
  }
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
  
  console.log(`🏢 Clubbed errors for ${Object.keys(tenantGroups).length} tenants`);
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
  console.log(`📋 Created ${uniqueRecords.length} unique records`);
  return uniqueRecords;
}

/**
 * Create JIRA tickets per error category and tenant
 */
function createJiraTickets(clubbedData) {
  const jiraResults = [];
  
  // Check if JIRA ticket creation is globally enabled
  if (!ERROR_CATEGORY_CONFIG.createJiraTickets) {
    console.log('🚫 JIRA ticket creation is disabled globally');
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
        console.log(`🚫 JIRA ticket creation disabled for category: ${category}`);
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
        jiraResults.push({
          tenant: tenant,
          category: category,
          success: true,
          ticketKey: jiraTicket.key,
          ticketUrl: `${JIRA_CONFIG.baseUrl}/browse/${jiraTicket.key}`,
          message: 'Ticket created successfully'
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
  
  console.log(`🎫 JIRA ticket creation completed: ${jiraResults.filter(r => r.success).length} success, ${jiraResults.filter(r => !r.success).length} failed`);
  return jiraResults;
}

/**
 * Create individual JIRA ticket
 */
function createJiraTicket(ticketData) {
  const summary = `Adobe Error: ${ticketData.category} - ${ticketData.tenant}`;
  
  // Get detailed records for this tenant/category combination
  const detailedRecords = getDetailedRecordsForTicket(ticketData.tenant, ticketData.category);
  
  // Get category-specific configuration for next steps
  const categoryConfig = ERROR_CATEGORY_CONFIG.categories[ticketData.category] || ERROR_CATEGORY_CONFIG.categories["Default"];
  const nextSteps = categoryConfig.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  
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
${nextSteps}`;

  const payload = {
    fields: {
      project: {
        key: JIRA_CONFIG.projectKey
      },
      summary: summary,
      description: description,
      issuetype: {
        name: JIRA_CONFIG.issueType
      },
      labels: ['appconnectors', 'automated']
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
    
    // Debug: Log available headers to help with column mapping
    console.log(`📋 Available headers in "Errors" sheet:`, headers);
    
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
        
        // Debug: Log first few records to check data mapping
        if (matchingRecords.length < 3) {
          console.log(`📝 Record ${matchingRecords.length + 1} data mapping:`, {
            companyUuid: companyUuid,
            customerId: customerId,
            subscriptionId: subscriptionId,
            rawRecord: record
          });
        }
        
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
    'Tenant', 'Error Category', 'Status', 'JIRA Ticket', 'Ticket URL', 'Message'
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
    .addSeparator()
    .addItem('⚙️ Configure JIRA Settings', 'showJiraConfig')
    .addItem('🔧 Configure Error Categories', 'showErrorCategoryConfig')
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
