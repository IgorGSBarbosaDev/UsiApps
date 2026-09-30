function gtgpGetDashboardData() {
  try {
    return gtgpApiSuccess_(gtgpBuildDashboardData_());
  } catch (error) {
    return gtgpApiFailure_(error);
  }
}

function gtgpExportDashboardXlsx(payload) {
  try {
    return gtgpApiSuccess_(gtgpBuildDashboardXlsx_(payload));
  } catch (error) {
    return gtgpApiFailure_(error);
  }
}
