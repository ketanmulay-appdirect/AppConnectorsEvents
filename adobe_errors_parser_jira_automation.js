/**
 * AppConnectors Adobe Errors Parser & JIRA Automation - Google Apps Script
 * ========================================================================
 * 
 * This script processes AppConnectors Adobe error data from the "Errors" sheet and:
 * 1. Clubs errors per tenant value
 * 2. Creates unique records per company, tenant, customer id, subscription id and error category
 * 3. Creates JIRA tickets separately per error category and for each tenant
 * 
 * Requirements: Data must be in a sheet named "Errors"
 * Main function: processCsvAndCreateJiraTickets()
 */

// JIRA Configuration - Update these with your JIRA details
const JIRA_CONFIG = {
  baseUrl: 'https://appdirect.jira.com/',
  username: 'ketan.mulay@appdirect.com',
  apiToken: 'ATATT3xFfGF0g9m3HPqv9_tyTY2KKkHW89jgrDqS-i3gNOMUt_A49Cm74j5wpTwFXkhIACPzgyLdAPoTjWEnEbQq5U9MgDAuhwnPODVtJ-rl9xzVSJg2mYha2Yuy_P-4tYnIQ0N8FayDyC4NPwt-x0Toz4jVeedLxg4NKyJEqgcX5P9jPlgR6OI=60CFC9B8', // Generate from JIRA Account Settings
  projectKey: 'AC', // Your JIRA project key
  issueType: 'Task' // Issue type for error tickets
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
  
  Object.keys(clubbedData).forEach(tenant => {
    Object.keys(clubbedData[tenant]).forEach(category => {
      const errorGroup = clubbedData[tenant][category];
      
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
  const summary = `AppConnectors Adobe Error: ${ticketData.category} - ${ticketData.tenant}`;
  
  // Get detailed records for this tenant/category combination
  const detailedRecords = getDetailedRecordsForTicket(ticketData.tenant, ticketData.category);
  
  const description = `*AppConnectors Adobe Error Report*

*Tenant:* ${ticketData.tenant}
*Error Category:* ${ticketData.category}
*Total Occurrences:* ${ticketData.count}
*Unique Customers Affected:* ${ticketData.uniqueCustomers}
*Unique Subscriptions Affected:* ${ticketData.uniqueSubscriptions}

*Time Range:*
• First Occurrence: ${ticketData.firstOccurrence}
• Last Occurrence: ${ticketData.lastOccurrence}

*Impact Level:* ${getPriority(ticketData.count, ticketData.uniqueCustomers)}

*Affected Accounts (Action Required):*
${detailedRecords.summary}

*Detailed Records:*
{code:title=Affected Customer/Subscription Details}
${detailedRecords.details}
{code}

*Sample Error Messages:*
{code:title=Error Examples}
${detailedRecords.errorSamples}
{code}

*Next Steps:*
1. Investigate root cause for ${ticketData.category} errors
2. Review affected customer accounts listed above
3. Check the specific Company UUIDs and Subscription IDs provided
4. Implement fix or workaround
5. Monitor for recurrence

*Data Analysis:*
• Most affected Company: ${detailedRecords.topCompany}
• Most affected Customer: ${detailedRecords.topCustomer}
• Error frequency pattern: ${detailedRecords.pattern}

_This ticket was automatically created by AppConnectors Adobe Error Automation._`;

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
        errorSamples: "No error samples available",
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
        errorSamples: "No error samples available",
        topCompany: "Unknown",
        topCustomer: "Unknown",
        pattern: "Unable to analyze"
      };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find matching records for this tenant/category
    const matchingRecords = [];
    const companyCount = {};
    const customerCount = {};
    const errorMessages = [];
    
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
        
        // Count companies and customers
        const companyUuid = record['Company Uuid'] || record.CompanyUuid || 'Unknown';
        const customerId = record['Customer ID'] || record.CustomerId || 'Unknown';
        const message = record.Message || record.message || '';
        
        companyCount[companyUuid] = (companyCount[companyUuid] || 0) + 1;
        customerCount[customerId] = (customerCount[customerId] || 0) + 1;
        
        if (message && errorMessages.length < 3) {
          errorMessages.push(message);
        }
      }
    });
    
    // Generate summary
    const uniqueCompanies = Object.keys(companyCount).length;
    const uniqueCustomers = Object.keys(customerCount).length;
    const uniqueSubscriptions = new Set(matchingRecords.map(r => r['Subscription ID'] || r.SubscriptionId || 'Unknown')).size;
    
    const summary = `• ${uniqueCompanies} unique companies affected\n• ${uniqueCustomers} unique customers affected\n• ${uniqueSubscriptions} unique subscriptions affected\n• ${matchingRecords.length} total error occurrences`;
    
    // Generate detailed records (limit to top 20 for readability)
    let details = "Company UUID | Customer ID | Subscription ID | Timestamp | Error\n";
    details += "-------------|-------------|-----------------|-----------|-------\n";
    
    const limitedRecords = matchingRecords.slice(0, 20);
    limitedRecords.forEach(record => {
      const companyUuid = (record['Company Uuid'] || record.CompanyUuid || 'Unknown').substring(0, 8) + '...';
      const customerId = record['Customer ID'] || record.CustomerId || 'Unknown';
      const subscriptionId = record['Subscription ID'] || record.SubscriptionId || 'Unknown';
      const timestamp = record.Timestamp || record.timestamp || 'Unknown';
      const error = (record.Error || record.error || 'Unknown').substring(0, 50) + '...';
      
      details += `${companyUuid} | ${customerId} | ${subscriptionId} | ${timestamp} | ${error}\n`;
    });
    
    if (matchingRecords.length > 20) {
      details += `\n... and ${matchingRecords.length - 20} more records\n`;
    }
    
    // Generate error samples
    let errorSamples = errorMessages.length > 0 ? errorMessages.join('\n\n---\n\n') : 'No error messages available';
    if (errorSamples.length > 1000) {
      errorSamples = errorSamples.substring(0, 1000) + '\n\n... (truncated)';
    }
    
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
      errorSamples: errorSamples,
      topCompany: topCompany.substring(0, 20) + (topCompany.length > 20 ? '...' : ''),
      topCustomer: topCustomer,
      pattern: pattern
    };
    
  } catch (error) {
    console.error('Error generating detailed records:', error);
    return {
      summary: "Error retrieving detailed data: " + error.message,
      details: "Unable to process records due to error",
      errorSamples: "Error samples unavailable",
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
  ui.createMenu('AppConnectors Adobe Errors Parser')
    .addItem('🚀 Process CSV & Create JIRA Tickets', 'processCsvAndCreateJiraTickets')
    .addSeparator()
    .addItem('📊 View Tenant Analysis', 'openTenantAnalysis')
    .addItem('📋 View Unique Records', 'openUniqueRecords')
    .addItem('🎫 View JIRA Tickets', 'openJiraTickets')
    .addSeparator()
    .addItem('⚙️ Configure JIRA Settings', 'showJiraConfig')
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
