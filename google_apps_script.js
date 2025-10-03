/**
 * AppConnectors Events Automation - Google Apps Script
 * ===================================================
 * 
 * Processes AppConnectors events data and generates comprehensive trend analysis.
 * 
 * Input Sheets: EventsByISV, ErrorEvents
 * Output Sheets: Dashboard, ISV Trends, Tenant Trends, Event Type Trends, Combined Trends, Charts, Action Required
 * 
 * Main function: processAppConnectorsEvents()
 */

// Error Categories Configuration
const ERROR_CATEGORIES = [
  {
    name: "Incorrect Downgrades",
    patterns: ["Unable to reduce the quantity", "No recent orders found", "Unable to downgrade the units immediately"],
    isKnownError: true,
    description: "Known issue with downgrade operations"
  },
  {
    name: "Adobe API Error", 
    patterns: ["invalid_client", "invalid client_id parameter", "400 Bad Request", "Error occurred invoking Adobe endpoint"],
    isKnownError: true,
    description: "Adobe API authentication issues"
  },
  {
    name: "Adobe Eligibility Error (2129)",
    patterns: ["Code: 2129", "Customer is not eligible", "VOLUME_DISCOUNT"],
    isKnownError: true,
    description: "Adobe customer eligibility restrictions"
  },
  {
    name: "Incorrect Pricebook",
    patterns: ["lower discount level", "price books are correctly configured", "Applicable Offer ID", "Verify that the price books are correctly configured"],
    isKnownError: true,
    description: "Pricebook configuration issues"
  },
  {
    name: "Soft Cancellation",
    patterns: ["Customer Account does not exists", "EventType=SUBSCRIPTION_CHANGE"],
    isKnownError: true,
    description: "Customer account soft cancellation scenarios"
  },
  {
    name: "Adobe Internal Error (1124)",
    patterns: ["Code: 1124", "Internal Server Error"],
    isKnownError: true,
    description: "Adobe internal server errors"
  },
  {
    name: "Incorrect Cancellation",
    patterns: ["Grace period is over", "cannot be cancelled"],
    isKnownError: true,
    description: "Cancellation outside grace period or policy violations"
  },
  {
    name: "ISV Error",
    patterns: ["failed to respond", "NoHttpResponseException", "I/O error", "partners.adobe.io:443 failed to respond", "443 failed to respond"],
    isKnownError: true,
    description: "Real ISV connectivity issues - requires investigation"
  },
  // Google-specific errors (Known Errors)
  {
    name: "Google Read Failure",
    patterns: ["Failed to read Google by customerId=", "and skuId="],
    isKnownError: true,
    description: "Google API read operation failures"
  },
  {
    name: "Subscription Not Found",
    patterns: ["Google Subscription with subscriptionId=", "not found"],
    isKnownError: true,
    description: "Google subscription lookup failures"
  },
  {
    name: "Subscription Read Failure",
    patterns: ["Reading subscription with subscriptionId=", "failed"],
    isKnownError: true,
    description: "Google subscription read operation failures"
  },
  {
    name: "Google 403 Forbidden",
    patterns: ["Failed to create Google subscription", "403 Forbidden"],
    isKnownError: true,
    description: "Google API permission denied errors"
  },
  {
    name: "Duplicate Subscription",
    patterns: ["409 Conflict", "Resource already exists"],
    isKnownError: true,
    description: "Google subscription already exists"
  },
  {
    name: "Google Precondition Failed",
    patterns: ["412 Precondition Failed"],
    isKnownError: true,
    description: "Google API precondition failures"
  },
  {
    name: "Google Bad Request",
    patterns: ["Failed to create Google subscription", "400 Bad Request"],
    isKnownError: true,
    description: "Google API bad request errors"
  },
  {
    name: "Google Create Failure",
    patterns: ["Failed to create Google subscription for customerId="],
    isKnownError: true,
    description: "General Google subscription creation failures"
  },
  {
    name: "Seat Reduction Not Allowed",
    patterns: ["Seat reduction is not allowed"],
    isKnownError: true,
    description: "Google seat reduction policy violations"
  },
  {
    name: "Seat Update Failure",
    patterns: ["Failed to update seats for subscriptionId="],
    isKnownError: true,
    description: "Google seat update operation failures"
  },
  {
    name: "Subscription Does Not Exist",
    patterns: ["Subscription with subscriptionId=", "does not exist"],
    isKnownError: true,
    description: "Google subscription not found errors"
  },
  {
    name: "Company Account Not Found",
    patterns: ["Unable to find account for CompanyId:"],
    isKnownError: true,
    description: "Company account lookup failures"
  },
  {
    name: "Transfer Failed - Duplicate Domain",
    patterns: ["Can't transfer customerId=", "because company already has a Google Customer Account"],
    isKnownError: true,
    description: "Google customer transfer failures due to existing accounts"
  },
  {
    name: "List Subscriptions Failed",
    patterns: ["Failed to get a list of subscriptions"],
    isKnownError: true,
    description: "Google subscription listing failures"
  },
  {
    name: "SKU Not Found",
    patterns: ["Sku not found for edition code="],
    isKnownError: true,
    description: "Google SKU lookup failures"
  },
  // Additional specific patterns from requirements
  {
    name: "Incorrect 3YC Operation",
    patterns: ["THREE_YEAR_COMMIT"],
    isKnownError: true,
    description: "Three-year commitment operation issues"
  },
  // Additional known error patterns
  {
    name: "Network Timeout",
    patterns: ["timeout", "connection reset"],
    isKnownError: true,
    description: "Network connectivity timeouts"
  },
  {
    name: "Rate Limiting",
    patterns: ["rate limit", "throttle"],
    isKnownError: true,
    description: "API rate limiting errors"
  },
  {
    name: "Scheduled Maintenance",
    patterns: ["maintenance", "scheduled downtime"],
    isKnownError: true,
    description: "Planned maintenance windows"
  },
  // Real failure patterns (Unknown/New Errors - Need Attention)
  {
    name: "Application Error",
    patterns: ["null pointer", "nullpointerexception"],
    isKnownError: false,
    description: "Application runtime errors requiring investigation"
  },
  {
    name: "Database Error",
    patterns: ["database", "sql"],
    isKnownError: false,
    description: "Database connectivity or query errors"
  },
  {
    name: "Memory Error",
    patterns: ["out of memory", "memory"],
    isKnownError: false,
    description: "Memory allocation errors"
  },
  {
    name: "Uncategorized",
    patterns: ["Exception occurred", "Error occurred"],
    isKnownError: false,
    description: "Uncategorized errors requiring investigation"
  }
];

/**
 * Main function to process AppConnectors events from multiple sheets
 */
function processAppConnectorsEvents() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Read data from input sheets
    const eventsByISVData = readEventsByISVData(spreadsheet);
    const errorEventsData = readErrorEventsData(spreadsheet);
    
    // Process and analyze data
    const combinedData = combineAllData(eventsByISVData, errorEventsData);
    const trendAnalysis = calculateComprehensiveTrends(combinedData);
    
    // Create analysis sheets
    createDashboardSheet(spreadsheet, trendAnalysis);
    createISVTrendsSheet(spreadsheet, trendAnalysis.isvTrends);
    createTenantTrendsSheet(spreadsheet, trendAnalysis.tenantTrends);
    createEventTypeTrendsSheet(spreadsheet, trendAnalysis.eventTypeTrends);
    createCombinedTrendsSheet(spreadsheet, trendAnalysis.combinedTrends);
    createChartsSheet(spreadsheet, trendAnalysis);
    
    // Create Action Required sheet
    createActionRequiredSheet(spreadsheet, combinedData);
    
    // Show completion message with filtering statistics
    const totalEvents = combinedData.length;
    const errorEventsProcessed = combinedData.filter(e => e.source === 'ErrorEvents').length;
    const knownErrorsFiltered = combinedData.filter(e => e.source === 'ErrorEvents' && e.isKnownError === true).length;
    const realFailuresFromErrors = errorEventsProcessed - knownErrorsFiltered;
    
    // Calculate total failed events across all sources
    const totalFailedEvents = combinedData.reduce((sum, e) => sum + e.failed, 0);
    const totalSuccessfulEvents = combinedData.reduce((sum, e) => sum + e.successful, 0);
    const totalAllEvents = combinedData.reduce((sum, e) => sum + e.allEvents, 0);
    
    // Try to show UI alert, but don't fail if UI is not available
    try {
      SpreadsheetApp.getUi().alert(
        'Multi-Sheet Analysis Complete!',
        `✅ Successfully processed data from 2 input sheets\n` +
        `📊 EventsByISV: ${eventsByISVData.length} records\n` +
        `🚨 ErrorEvents: ${errorEventsData.length} records\n` +
        `🔍 Known errors filtered out: ${knownErrorsFiltered}\n` +
        `⚠️ Real failures from ErrorEvents: ${realFailuresFromErrors}\n` +
        `📈 Trend data points (filtered): ${trendAnalysis.totalDataPoints}\n` +
        `📊 ISV Codes analyzed: ${trendAnalysis.isvTrends.length}\n` +
        `🏢 Tenants analyzed: ${trendAnalysis.tenantTrends.length}\n` +
        `📋 Event types analyzed: ${trendAnalysis.eventTypeTrends.length}\n` +
        `🔗 Combined trends: ${trendAnalysis.combinedTrends.length}\n\n` +
        `Check new sheets: Dashboard, ISV Trends, Tenant Trends, Event Type Trends, Combined Trends, Charts`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiError) {
      // UI not available - processing completed silently
    }
    
  } catch (error) {
    // Try to show error alert, but don't fail if UI is not available
    try {
      SpreadsheetApp.getUi().alert('Error', `Processing failed: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiError) {
      throw error; // Re-throw the original error
    }
  }
}


/**
 * Read data from EventsByISV sheet
 */
function readEventsByISVData(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("EventsByISV");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const event = {};
    headers.forEach((header, index) => {
      event[header] = row[index];
    });
    return event;
  }).filter(event => event.ISVCODE || event.ISVCode || event['ISV Code']);
}


/**
 * Read data from ErrorEvents sheet
 */
function readErrorEventsData(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("ErrorEvents");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const event = {};
    headers.forEach((header, index) => {
      event[header] = row[index];
    });
    return event;
  }).filter(event => event.Message || event.Category);
}

/**
 * Combine data from input sheets into unified format
 */
function combineAllData(eventsByISVData, errorEventsData) {
  const combinedData = [];
  
  // Process EventsByISV data
  eventsByISVData.forEach(event => {
    const month = event.Month || 'Sept\'25';
    const isvCode = event.ISVCODE || event.ISVCode || event['ISV Code'] || 'Unknown';
    const eventType = event.EVENTTYPE || event.EventType || event['Event Type'] || 'Unknown';
    const tenant = event.TENANT || event.Tenant || 'Unknown';
    const failed = parseInt(event.Failed || 0);
    const allEvents = parseInt(event['All Events'] || event.AllEvents || 0);
    const successful = parseInt(event.Successful || 0);
    const failureRate = parseFloat(event['Failure Rate'] || 0);
    
    combinedData.push({
      month: month,
      isvCode: isvCode,
      eventType: eventType,
      tenant: tenant,
      failed: failed,
      allEvents: allEvents,
      successful: successful,
      failureRate: failureRate,
      source: 'EventsByISV',
      key: `${month}_${isvCode}_${eventType}_${tenant}`
    });
  });
  
  // Process ErrorEvents data with categorization
  errorEventsData.forEach(event => {
    const month = event.Month || 'Sept\'25';
    const message = event.Message || '';
    const category = categorizeErrorMessage(message, event.Category);
    const isvCode = event['ISV Code'] || event.ISVCode || 'Unknown';
    const eventType = event['Event Type'] || event.EventType || 'Unknown';
    const tenant = event.Tenant || 'Unknown';
    
    const isRealFailure = !category.isKnownError;
    
    combinedData.push({
      month: month,
      isvCode: isvCode,
      eventType: eventType,
      tenant: tenant,
      failed: isRealFailure ? 1 : 0,
      allEvents: 1,
      successful: isRealFailure ? 0 : 1,
      failureRate: isRealFailure ? 100 : 0,
      category: category.name,
      isKnownError: category.isKnownError,
      isRealFailure: isRealFailure,
      source: 'ErrorEvents',
      key: `${month}_${isvCode}_${eventType}_${tenant}_${category.name}`,
      originalEvent: {
        'Event ID': event['Event ID'] || event.EventID || event.eventId,
        'Timestamp': event.Timestamp || event.timestamp,
        'Message': message,
        'ISV Code': isvCode,
        'Event Type': eventType,
        'Tenant': tenant,
        'Month': month,
        'Category': event.Category || category.name
      }
    });
  });
  
  return combinedData;
}

/**
 * Categorize error message using patterns
 */
function categorizeErrorMessage(message, existingCategory) {
  const messageText = (message || '').toString().toLowerCase();
  
  // Try existing category first
  if (existingCategory) {
    const categoryMatch = ERROR_CATEGORIES.find(cat => cat.name === existingCategory);
    if (categoryMatch) {
      return categoryMatch;
    }
  }
  
  // Pattern matching
  for (const category of ERROR_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (messageText.includes(pattern.toLowerCase())) {
        return category;
      }
    }
  }
  
  // Default to uncategorized
  return {
    name: "Uncategorized",
    isKnownError: false,
    description: "Uncategorized errors requiring investigation"
  };
}

/**
 * Calculate comprehensive trends across all dimensions
 */
function calculateComprehensiveTrends(combinedData) {
  // Filter data to exclude known errors and use only real failures
  const filteredData = combinedData.filter(item => {
    if (item.source === 'EventsByISV') return true;
    if (item.source === 'ErrorEvents') return !item.isKnownError;
    return true;
  });
  
  // Adjust EventsByISV failure counts based on ErrorEvents real failure rate
  const errorEventsData = combinedData.filter(item => item.source === 'ErrorEvents');
  const totalErrorEvents = errorEventsData.length;
  const realFailureEvents = errorEventsData.filter(item => !item.isKnownError).length;
  const realFailureRate = totalErrorEvents > 0 ? realFailureEvents / totalErrorEvents : 0;
  
  // Apply real failure rate to EventsByISV data
  const adjustedData = filteredData.map(item => {
    if (item.source === 'EventsByISV') {
      const adjustedFailed = Math.round(item.failed * realFailureRate);
      return {
        ...item,
        failed: adjustedFailed,
        successful: item.allEvents - adjustedFailed
      };
    }
    return item;
  }).filter(item => item.source === 'EventsByISV'); // Only use EventsByISV for trends
  
  
  // Group by ISV Code
  const isvTrends = calculateTrendsByDimension(adjustedData, 'isvCode');
  
  // Group by Tenant (extracted from EventsByISV data)
  const tenantTrends = calculateTrendsByDimension(adjustedData, 'tenant');
  
  // Group by Event Type
  const eventTypeTrends = calculateTrendsByDimension(adjustedData, 'eventType');
  
  // Combined trends (ISV + Event Type + Tenant)
  const combinedTrends = calculateCombinedTrends(adjustedData);
  
  return {
    isvTrends: isvTrends,
    tenantTrends: tenantTrends,
    eventTypeTrends: eventTypeTrends,
    combinedTrends: combinedTrends,
    totalDataPoints: filteredData.length
  };
}

/**
 * Calculate trends by a specific dimension
 */
function calculateTrendsByDimension(data, dimension) {
  const grouped = {};
  
  data.forEach(item => {
    const key = item[dimension];
    const month = item.month;
    
    if (!grouped[key]) {
      grouped[key] = {};
    }
    
    if (!grouped[key][month]) {
      grouped[key][month] = {
        failed: 0,
        allEvents: 0,
        successful: 0,
        count: 0
      };
    }
    
    grouped[key][month].failed += item.failed;
    grouped[key][month].allEvents += item.allEvents;
    grouped[key][month].successful += item.successful;
    grouped[key][month].count += 1;
  });
  
  // Convert to trend format
  const trends = [];
  Object.keys(grouped).forEach(key => {
    const months = Object.keys(grouped[key]).sort();
    months.forEach(month => {
      const stats = grouped[key][month];
      const failureRate = stats.allEvents > 0 ? (stats.failed / stats.allEvents * 100) : 0;
      
      trends.push({
        [dimension]: key,
        month: month,
        failed: stats.failed,
        allEvents: stats.allEvents,
        successful: stats.successful,
        failureRate: Math.round(failureRate * 100) / 100,
        dataPoints: stats.count
      });
    });
  });
  
  return trends;
}

/**
 * Calculate combined trends (multi-dimensional)
 */
function calculateCombinedTrends(data) {
  const grouped = {};
  
  data.forEach(item => {
    const key = `${item.isvCode}|${item.eventType}|${item.tenant}`;
    const month = item.month;
    
    if (!grouped[key]) {
      grouped[key] = {};
    }
    
    if (!grouped[key][month]) {
      grouped[key][month] = {
        failed: 0,
        allEvents: 0,
        successful: 0,
        count: 0
      };
    }
    
    grouped[key][month].failed += item.failed;
    grouped[key][month].allEvents += item.allEvents;
    grouped[key][month].successful += item.successful;
    grouped[key][month].count += 1;
  });
  
  // Convert to trend format
  const trends = [];
  Object.keys(grouped).forEach(key => {
    const [isvCode, eventType, tenant] = key.split('|');
    const months = Object.keys(grouped[key]).sort();
    
    months.forEach(month => {
      const stats = grouped[key][month];
      const failureRate = stats.allEvents > 0 ? (stats.failed / stats.allEvents * 100) : 0;
      
      trends.push({
        isvCode: isvCode,
        eventType: eventType,
        tenant: tenant,
        month: month,
        failed: stats.failed,
        allEvents: stats.allEvents,
        successful: stats.successful,
        failureRate: Math.round(failureRate * 100) / 100,
        dataPoints: stats.count,
        combinedKey: key
      });
    });
  });
  
  return trends;
}

/**
 * Create or update Dashboard sheet
 */
function createDashboardSheet(spreadsheet, trendAnalysis) {
  let sheet = spreadsheet.getSheetByName("Dashboard");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Dashboard");
  } else {
    sheet.clear();
  }
  
  // Calculate summary statistics
  const totalISVs = trendAnalysis.isvTrends.length;
  const totalTenants = trendAnalysis.tenantTrends.length;
  const totalEventTypes = trendAnalysis.eventTypeTrends.length;
  const totalCombinations = trendAnalysis.combinedTrends.length;
  
  // Calculate filtering statistics from the raw data
  const spreadsheetData = SpreadsheetApp.getActiveSpreadsheet();
  const errorEventsSheet = spreadsheetData.getSheetByName("ErrorEvents");
  let errorEventsCount = 0;
  let knownErrorsFiltered = 0;
  
  if (errorEventsSheet) {
    const errorData = errorEventsSheet.getDataRange().getValues();
    if (errorData.length > 1) {
      const headers = errorData[0];
      const rows = errorData.slice(1);
      
      rows.forEach(row => {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        
        if (event.Message || event.Category) {
          errorEventsCount++;
          const category = categorizeErrorMessage(event.Message || '', event.Category);
          if (category.isKnownError) {
            knownErrorsFiltered++;
          }
        }
      });
    }
  }
  
  // Calculate totals from EventsByISV only (to match your sheet sum)
  const eventsByISVSheet = spreadsheetData.getSheetByName("EventsByISV");
  let totalEventsFromISV = 0;
  let totalFailedFromISV = 0;
  let totalSuccessfulFromISV = 0;
  
  if (eventsByISVSheet) {
    const isvData = eventsByISVSheet.getDataRange().getValues();
    if (isvData.length > 1) {
      const headers = isvData[0];
      const rows = isvData.slice(1);
      
      rows.forEach(row => {
        const event = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        
        if (event['All Events'] || event.AllEvents) {
          totalEventsFromISV += parseInt(event['All Events'] || event.AllEvents || 0);
          totalFailedFromISV += parseInt(event.Failed || 0);
          totalSuccessfulFromISV += parseInt(event.Successful || 0);
        }
      });
    }
  }
  
  // Calculate totals from filtered trend analysis (should match trend sheets)
  const totalFailedFromTrends = trendAnalysis.isvTrends.reduce((sum, trend) => sum + trend.failed, 0);
  const totalEventsFromTrends = trendAnalysis.isvTrends.reduce((sum, trend) => sum + trend.allEvents, 0);
  const totalSuccessfulFromTrends = trendAnalysis.isvTrends.reduce((sum, trend) => sum + trend.successful, 0);
  
  // Calculate real failures from trend analysis (should match trend sheets)
  const realFailuresFromTrends = trendAnalysis.isvTrends.reduce((sum, trend) => sum + trend.failed, 0);
  const realFailuresCount = realFailuresFromTrends; // Use trend calculation for consistency
  const filterEffectiveness = errorEventsCount > 0 ? Math.round((knownErrorsFiltered / errorEventsCount) * 100) : 0;
  
  const dashboardData = [
    ['AppConnectors Events Dashboard', '', '', ''],
    ['', '', '', ''],
    ['📊 Main Metrics (From Your EventsByISV Sheet)', '', '', ''],
    ['Total Events:', totalEventsFromISV.toLocaleString(), '', ''],
    ['Failed Events:', totalFailedFromISV, '', ''],
    ['Successful Events:', totalSuccessfulFromISV.toLocaleString(), '', ''],
    ['Overall Failure Rate:', totalEventsFromISV > 0 ? `${Math.round((totalFailedFromISV/totalEventsFromISV)*100*100)/100}%` : '0%', '', ''],
    ['', '', '', ''],
    ['🔍 Error Filtering Results', '', '', ''],
    ['Individual Error Events Analyzed:', errorEventsCount, '', ''],
    ['Known Errors (Ignored):', knownErrorsFiltered, '', ''],
    ['Real Failures (Need Attention):', realFailuresCount, '', ''],
    ['Real Failure Rate:', totalEventsFromISV > 0 ? `${Math.round((realFailuresCount/totalEventsFromISV)*100*100)/100}%` : '0%', '', ''],
    ['', '', '', ''],
    ['📈 Analysis Available', '', '', ''],
    ['ISV Codes Analyzed:', totalISVs, '', ''],
    ['Tenants Analyzed:', totalTenants, '', ''],
    ['Event Types Analyzed:', totalEventTypes, '', ''],
    ['Trend Combinations:', totalCombinations, '', ''],
    ['', '', '', ''],
    ['📋 Key Insights', '', '', ''],
    [`• ${Math.round(((totalSuccessfulFromISV/totalEventsFromISV)*100)*10)/10}% of events are successful`, '', '', ''],
    [`• ${Math.round(((totalFailedFromISV/totalEventsFromISV)*100)*10)/10}% of events have failures`, '', '', ''],
    [`• ${Math.round(((realFailuresCount/totalEventsFromISV)*100)*1000)/1000}% are real failures needing attention`, '', '', ''],
    [`• Error filtering is ${filterEffectiveness}% effective`, '', '', ''],
    ['', '', '', ''],
    ['🕐 Last Updated:', new Date().toLocaleString(), '', ''],
    ['', '', '', ''],
    ['📊 View Analysis Sheets:', '', '', ''],
    ['• ISV Trends - Performance by ISV', '', '', ''],
    ['• Tenant Trends - Performance by Tenant', '', '', ''],
    ['• Event Type Trends - Performance by Event Type', '', '', ''],
    ['• Combined Trends - Multi-dimensional view', '', '', ''],
    ['• Charts - Visual monthly trends', '', '', '']
  ];
  
  // Add dashboard content
  sheet.getRange(1, 1, dashboardData.length, 4).setValues(dashboardData);
  
  // Format dashboard
  sheet.getRange(1, 1, 1, 4)
    .setBackground('#1a73e8')
    .setFontColor('white')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');
  
  // Format section headers
  [3, 9, 15, 21, 27, 29].forEach(row => {
    sheet.getRange(row, 1, 1, 1)
      .setBackground('#f0f0f0')
      .setFontWeight('bold')
      .setFontSize(12);
  });
  
  // Highlight the main metrics section (your data)
  sheet.getRange(3, 1, 1, 1)
    .setBackground('#d4edda')
    .setFontWeight('bold')
    .setFontSize(12);
    
  // Highlight the filtering section
  sheet.getRange(9, 1, 1, 1)
    .setBackground('#fff3cd')
    .setFontWeight('bold')
    .setFontSize(12);
    
  // Highlight the Real Failure Rate row (key metric)
  sheet.getRange(13, 1, 1, 2)
    .setBackground('#ffebee')
    .setFontWeight('bold');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 4);
  
}

/**
 * Create or update ISV Trends sheet
 */
function createISVTrendsSheet(spreadsheet, isvTrends) {
  let sheet = spreadsheet.getSheetByName("ISV Trends");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("ISV Trends");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = ['ISV Code', 'Month', 'Failed Events', 'Total Events', 'Successful Events', 'Failure Rate (%)', 'Last Updated'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#34a853')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Add trends data
  if (isvTrends.length > 0) {
    const trendsData = isvTrends.map(trend => [
      trend.isvCode,
      trend.month,
      trend.failed,
      trend.allEvents,
      trend.successful,
      trend.failureRate.toFixed(2) + '%',
      new Date().toLocaleString()
    ]);
    
    sheet.getRange(2, 1, trendsData.length, headers.length).setValues(trendsData);
    
    // Format data rows with conditional formatting
    trendsData.forEach((row, index) => {
      const rowNum = index + 2;
      const failureRate = row[5];
      let color = '#f0f8f0'; // Default green
      if (failureRate > 50) color = '#fce5cd'; // Orange for high failure rates
      if (failureRate > 80) color = '#f4cccc'; // Red for very high failure rates
      
      sheet.getRange(rowNum, 1, 1, headers.length).setBackground(color);
    });
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
}

/**
 * Create or update Tenant Trends sheet
 */
function createTenantTrendsSheet(spreadsheet, tenantTrends) {
  let sheet = spreadsheet.getSheetByName("Tenant Trends");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Tenant Trends");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = ['Tenant', 'Month', 'Failed Events', 'Total Events', 'Successful Events', 'Failure Rate (%)', 'Last Updated'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Add trends data
  if (tenantTrends.length > 0) {
    const trendsData = tenantTrends.map(trend => [
      trend.tenant,
      trend.month,
      trend.failed,
      trend.allEvents,
      trend.successful,
      trend.failureRate.toFixed(2) + '%',
      new Date().toLocaleString()
    ]);
    
    sheet.getRange(2, 1, trendsData.length, headers.length).setValues(trendsData);
    
    // Format data rows
    sheet.getRange(2, 1, trendsData.length, headers.length).setBackground('#f0f4ff');
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
}

/**
 * Create or update Event Type Trends sheet
 */
function createEventTypeTrendsSheet(spreadsheet, eventTypeTrends) {
  let sheet = spreadsheet.getSheetByName("Event Type Trends");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Event Type Trends");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = ['Event Type', 'Month', 'Failed Events', 'Total Events', 'Successful Events', 'Failure Rate (%)', 'Last Updated'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#ea4335')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Add trends data
  if (eventTypeTrends.length > 0) {
    const trendsData = eventTypeTrends.map(trend => [
      trend.eventType,
      trend.month,
      trend.failed,
      trend.allEvents,
      trend.successful,
      trend.failureRate.toFixed(2) + '%',
      new Date().toLocaleString()
    ]);
    
    sheet.getRange(2, 1, trendsData.length, headers.length).setValues(trendsData);
    
    // Format data rows
    sheet.getRange(2, 1, trendsData.length, headers.length).setBackground('#fff0f0');
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
}

/**
 * Create or update Combined Trends sheet
 */
function createCombinedTrendsSheet(spreadsheet, combinedTrends) {
  let sheet = spreadsheet.getSheetByName("Combined Trends");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Combined Trends");
  } else {
    sheet.clear();
  }
  
  // Headers
  const headers = ['ISV Code', 'Event Type', 'Tenant', 'Month', 'Failed Events', 'Total Events', 'Successful Events', 'Failure Rate (%)', 'Last Updated'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#9c27b0')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Add trends data
  if (combinedTrends.length > 0) {
    const trendsData = combinedTrends.map(trend => [
      trend.isvCode,
      trend.eventType,
      trend.tenant,
      trend.month,
      trend.failed,
      trend.allEvents,
      trend.successful,
      trend.failureRate.toFixed(2) + '%',
      new Date().toLocaleString()
    ]);
    
    sheet.getRange(2, 1, trendsData.length, headers.length).setValues(trendsData);
    
    // Format data rows with alternating colors
    trendsData.forEach((row, index) => {
      const rowNum = index + 2;
      const color = index % 2 === 0 ? '#f8f0ff' : '#ffffff';
      sheet.getRange(rowNum, 1, 1, headers.length).setBackground(color);
    });
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
}

/**
 * Create or update Charts sheet with aggregate monthly trend data
 */
function createChartsSheet(spreadsheet, trendAnalysis) {
  let sheet = spreadsheet.getSheetByName("Charts");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Charts");
  } else {
    sheet.clear();
  }
  
  // Calculate aggregate monthly trends (like your reference screenshot)
  const monthlyAggregates = {};
  
  // Aggregate all ISV trends by month
  trendAnalysis.isvTrends.forEach(trend => {
    if (!monthlyAggregates[trend.month]) {
      monthlyAggregates[trend.month] = {
        totalEvents: 0,
        totalFailed: 0,
        totalSuccessful: 0
      };
    }
    monthlyAggregates[trend.month].totalEvents += trend.allEvents;
    monthlyAggregates[trend.month].totalFailed += trend.failed;
    monthlyAggregates[trend.month].totalSuccessful += trend.successful;
  });
  
  // Sort months
  const months = Object.keys(monthlyAggregates).sort();
  
  // Create chart data with consistent 6 columns
  const chartData = [
    ['AppConnectors Monthly Error Rate Trend', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['📊 Chart Data (Select A4:B' + (4 + months.length) + ' for Line Chart)', '', '', '', '', ''],
    ['Month', 'Error Rate (%)', 'Total Events', '', '', ''],
  ];
  
  // Add monthly data rows optimized for line chart
  months.forEach(month => {
    const data = monthlyAggregates[month];
    const errorRate = data.totalEvents > 0 ? parseFloat(((data.totalFailed / data.totalEvents) * 100).toFixed(3)) : 0;
    
    chartData.push([
      month,
      errorRate,
      data.totalEvents,
      '',
      '',
      ''
    ]);
  });
  
  // Add spacing and detailed breakdown
  chartData.push(['', '', '', '', '', '']);
  chartData.push(['📈 Detailed Monthly Summary:', '', '', '', '', '']);
  chartData.push(['Month', 'Total Events', 'Failed Events', 'Success Events', 'Error Rate (%)', 'Success Rate (%)']);
  
  // Add detailed monthly data
  months.forEach(month => {
    const data = monthlyAggregates[month];
    const errorRate = data.totalEvents > 0 ? ((data.totalFailed / data.totalEvents) * 100).toFixed(2) : '0.00';
    const successRate = data.totalEvents > 0 ? ((data.totalSuccessful / data.totalEvents) * 100).toFixed(2) : '0.00';
    
    chartData.push([
      month,
      data.totalEvents,
      data.totalFailed,
      data.totalSuccessful,
      errorRate,
      successRate
    ]);
  });
  
  // Add spacing and chart instructions
  chartData.push(['', '', '', '', '', '']);
  chartData.push(['📈 How to Create the Trend Chart:', '', '', '', '', '']);
  chartData.push(['1. Select range A4:B' + (4 + months.length) + ' (Month + Error Rate)', '', '', '', '', '']);
  chartData.push(['2. Insert → Chart → Line Chart', '', '', '', '', '']);
  chartData.push(['3. Chart will show Error Rate (%) trend over months', '', '', '', '', '']);
  chartData.push(['4. Similar to your reference "Overall Weekly Trend"', '', '', '', '', '']);
  chartData.push(['', '', '', '', '', '']);
  
  // Add breakdown by ISV for reference
  chartData.push(['📊 Monthly Breakdown by ISV (Reference Data):', '', '', '', '', '']);
  chartData.push(['ISV Code', 'Month', 'Failed Events', 'Total Events', 'Error Rate (%)', '']);
  
  trendAnalysis.isvTrends.forEach(trend => {
    chartData.push([
      trend.isvCode,
      trend.month,
      trend.failed,
      trend.allEvents,
      trend.failureRate.toFixed(2),
      ''
    ]);
  });
  
  // Add the data to sheet
  if (chartData.length > 0) {
    sheet.getRange(1, 1, chartData.length, 6).setValues(chartData);
    
    // Format title
    sheet.getRange(1, 1, 1, 6)
      .setBackground('#ff9800')
      .setFontColor('white')
      .setFontWeight('bold')
      .setFontSize(16)
      .setHorizontalAlignment('center');
    
    // Format chart data section header
    sheet.getRange(3, 1, 1, 3)
      .setBackground('#e8f5e8')
      .setFontWeight('bold')
      .setFontSize(12);
      
    // Format chart data table header (Month, Error Rate %, Total Events)
    sheet.getRange(4, 1, 1, 3)
      .setBackground('#f0f8f0')
      .setFontWeight('bold');
      
    // Highlight the Error Rate column for easy chart selection
    const chartDataEnd = 4 + months.length;
    sheet.getRange(5, 2, months.length, 1)
      .setBackground('#fff2cc');
      
    // Format detailed summary section
    const detailStart = chartDataEnd + 2;
    sheet.getRange(detailStart, 1, 1, 1)
      .setBackground('#e3f2fd')
      .setFontWeight('bold')
      .setFontSize(12);
      
    // Format detailed summary header
    sheet.getRange(detailStart + 1, 1, 1, 6)
      .setBackground('#f5f5f5')
      .setFontWeight('bold');
      
    // Format instructions section
    const instructionsStart = detailStart + 2 + months.length + 1;
    sheet.getRange(instructionsStart, 1, 1, 1)
      .setBackground('#fff3e0')
      .setFontWeight('bold');
      
    // Format ISV breakdown header
    const isvBreakdownStart = instructionsStart + 6;
    sheet.getRange(isvBreakdownStart, 1, 1, 1)
      .setBackground('#f3e5f5')
      .setFontWeight('bold');
      
    sheet.getRange(isvBreakdownStart + 1, 1, 1, 6)
      .setBackground('#f5f5f5')
      .setFontWeight('bold');
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 6);
  
}

/**
 * Create or update Action Required sheet with real failures needing attention
 */
function createActionRequiredSheet(spreadsheet, combinedData) {
  let sheet = spreadsheet.getSheetByName("Action Required");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Action Required");
  } else {
    // Clear all content and formatting
    sheet.clear();
    sheet.clearFormats();
    // Reset frozen rows
    sheet.setFrozenRows(0);
    // Delete all rows except the first 1000 (Google Sheets minimum)
    const maxRows = sheet.getMaxRows();
    if (maxRows > 1000) {
      sheet.deleteRows(1001, maxRows - 1000);
    }
    // Delete all columns except the first 26 (Google Sheets minimum)
    const maxCols = sheet.getMaxColumns();
    if (maxCols > 26) {
      sheet.deleteColumns(27, maxCols - 26);
    }
  }
  
  // Validate input data
  if (!combinedData || !Array.isArray(combinedData)) {
    console.error("❌ Combined data is not valid for Action Required sheet");
    return;
  }
  
  // Filter for real failures only (non-known errors from ErrorEvents)
  const actionRequiredEvents = combinedData.filter(item => 
    item && item.source === 'ErrorEvents' && !item.isKnownError
  );
  
  // Headers
  const headers = [
    'Event ID', 'ISV Code', 'Event Type', 'Tenant', 'Month', 
    'Error Category', 'Message', 'Timestamp', 'Status'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  if (actionRequiredEvents.length > 0) {
    const actionData = actionRequiredEvents.map((event, index) => {
      const originalEvent = event.originalEvent || {};
      
      const isvCode = originalEvent['ISV Code'] || event.isvCode || 'Unknown';
      const eventType = originalEvent['Event Type'] || event.eventType || 'Unknown';
      const tenant = originalEvent['Tenant'] || event.tenant || 'Unknown';
      const errorCategory = event.category || originalEvent['Category'] || 'Uncategorized';
      const message = originalEvent['Message'] || event.message || 'No message available';
      const month = originalEvent['Month'] || event.month || 'Unknown';
      const eventId = originalEvent['Event ID'] || event['Event ID'] || event.eventId || event['EventID'] || `ERR-${Date.now()}-${index + 1}`;
      const timestamp = originalEvent['Timestamp'] || event.Timestamp || event.timestamp || event['Timestamp'] || 'Unknown';
      
      const truncatedMessage = message.length > 150 
        ? message.substring(0, 150) + '...' 
        : message;
      
      return [
        eventId,
        isvCode,
        eventType,
        tenant,
        month,
        errorCategory,
        truncatedMessage,
        timestamp,
        'Open'
      ];
    });
    
    sheet.getRange(2, 1, actionData.length, headers.length).setValues(actionData);
    
    // Apply alternating row colors
    actionData.forEach((row, index) => {
      const rowNumber = index + 2;
      const backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      sheet.getRange(rowNumber, 1, 1, headers.length).setBackground(backgroundColor);
    });
    
    // Add summary at the top
    sheet.insertRows(1, 3);
    sheet.getRange(1, 1, 1, headers.length).setValues([['Action Required - Real Failures Needing Investigation', '', '', '', '', '', '', '', '']]);
    sheet.getRange(2, 1, 1, headers.length).setValues([['', '', '', '', '', '', '', '', '']]);
    sheet.getRange(3, 1, 1, headers.length).setValues([[
      `Total Events: ${actionRequiredEvents.length}`,
      `Individual Events Requiring Action`,
      '', '', '', '', '', '', ''
    ]]);
    
    // Format title and summary
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('white')
      .setFontWeight('bold')
      .setFontSize(16)
      .setHorizontalAlignment('center');
      
    sheet.getRange(3, 1, 1, headers.length)
      .setBackground('#f8f9fa')
      .setFontWeight('bold');
    
    // Update header row position
    sheet.getRange(4, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('white')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  } else {
    sheet.getRange(2, 1, 1, headers.length).setValues([['No Action Required - All Errors Are Known/Categorized!', '', '', '', '', '', '', '', '']]);
    sheet.getRange(2, 1, 1, headers.length)
      .setBackground('#d4edda')
      .setFontColor('#155724')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  // Freeze header rows
  sheet.setFrozenRows(4);
}

/**
 * Create menu item for easy access
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('AppConnectors Multi-Trend Analysis')
    .addItem('🚀 Process All Sheets', 'processAppConnectorsEvents')
    .addItem('📊 Refresh Trends', 'processAppConnectorsEvents')
    .addSeparator()
    .addItem('📈 View Dashboard', 'openDashboard')
    .addItem('🏢 View ISV Trends', 'openISVTrends')
    .addItem('🏢 View Tenant Trends', 'openTenantTrends')
    .addItem('📋 View Event Type Trends', 'openEventTypeTrends')
    .addItem('🔗 View Combined Trends', 'openCombinedTrends')
    .addItem('📊 View Charts', 'openCharts')
    .addSeparator()
    .addItem('Action Required', 'openActionRequired')
    .addToUi();
}

/**
 * Helper functions to open specific sheets
 */
function openDashboard() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dashboard");
  if (sheet) sheet.activate();
}

function openISVTrends() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ISV Trends");
  if (sheet) sheet.activate();
}

function openTenantTrends() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tenant Trends");
  if (sheet) sheet.activate();
}

function openEventTypeTrends() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Event Type Trends");
  if (sheet) sheet.activate();
}

function openCombinedTrends() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Combined Trends");
  if (sheet) sheet.activate();
}

function openCharts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Charts");
  if (sheet) sheet.activate();
}

function openActionRequired() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Action Required");
  if (sheet) sheet.activate();
}

