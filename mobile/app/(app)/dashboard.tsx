import React from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useQueries } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { usePermissions } from '../../src/hooks/usePermissions';
import { projectsApi, issuesApi, unitsApi, sprintsApi, usersApi, rolesApi } from '../../src/api/resources';
import { DepartmentHeadHome, ProjectManagerHome } from '../../src/components/home/ManagerHomes';
import { AdminHome, WorkerHome } from '../../src/components/home/StaffHomes';
import RequesterHome from '../../src/components/home/RequesterHome';
import { THEME } from '../../src/utils/constants';

/** Ana Sayfa — one home per role, identical to the web's Dashboard. */
export default function DashboardScreen() {
  const { currentUser } = useAuth();
  const { isDepartmentHead, isProjectManager, isWorker, isExternalUser } = usePermissions();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list, enabled: isExternalUser });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: !isExternalUser });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list, enabled: !isExternalUser });

  const projects = projectsQuery.data || [];
  const sprintQueries = useQueries({
    queries: (isExternalUser ? [] : projects).map((p) => ({
      queryKey: ['sprints', p.id],
      queryFn: () => sprintsApi.listByProject(p.id),
    })),
  });

  function refresh() {
    projectsQuery.refetch();
    issuesQuery.refetch();
    if (!isExternalUser) {
      unitsQuery.refetch();
      usersQuery.refetch();
      sprintQueries.forEach((q) => q.refetch());
    }
  }

  if (!currentUser || projectsQuery.isLoading || issuesQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }

  const issues = issuesQuery.data || [];
  const data = {
    currentUser, issues, projects, users: usersQuery.data || [], units: unitsQuery.data || [],
    sprints: sprintQueries.flatMap((q) => q.data || []),
  };

  let home: React.ReactNode;
  if (isDepartmentHead) home = <DepartmentHeadHome {...data} />;
  else if (isProjectManager) home = <ProjectManagerHome {...data} />;
  else if (isWorker) home = <WorkerHome {...data} />;
  else if (isExternalUser) home = <RequesterHome currentUser={currentUser} issues={issues} projects={projects} roles={rolesQuery.data || []} />;
  else home = <AdminHome {...data} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={projectsQuery.isFetching || issuesQuery.isFetching} onRefresh={refresh} />}>
        {home}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40 },
});
