import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { FolderItem } from '../../types';

export const FoldersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [folders, setFolders] = useState<FolderItem[]>([
    {
      _id: 'f_1',
      userId: '1',
      name: 'Work Documents',
      documentCount: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'f_2',
      userId: '1',
      name: 'Personal & Family',
      documentCount: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'f_3',
      userId: '1',
      name: 'Tax & Receipts',
      documentCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const handleCreateFolder = () => {
    Alert.prompt?.('New Folder', 'Enter folder name:', (name) => {
      if (name?.trim()) {
        const newF: FolderItem = {
          _id: 'f_' + Date.now(),
          userId: '1',
          name: name.trim(),
          documentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setFolders([...folders, newF]);
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Folders</Text>
        <TouchableOpacity onPress={handleCreateFolder}>
          <Text style={styles.createText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.folderCard}
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'DocumentsTab',
                params: { folderId: item._id },
              })
            }
          >
            <View style={styles.left}>
              <Text style={styles.folderIcon}>📁</Text>
              <View>
                <Text style={styles.folderName}>{item.name}</Text>
                <Text style={styles.folderSub}>{item.documentCount} items</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backText: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  createText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    ...shadows.card,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  folderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  folderSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
});

