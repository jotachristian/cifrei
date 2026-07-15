import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylist, getPlaylistChords, ChordInPlaylist } from '@/lib/database';
import { transposeTone } from '@/lib/transpose';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('Playlist');
  const [chords, setChords] = useState<ChordInPlaylist[]>([]);

  useFocusEffect(
    useCallback(() => {
      const p = getPlaylist(id);
      setName(p?.name ?? 'Playlist');
      setChords(getPlaylistChords(id));
    }, [id])
  );

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Pressable onPress={() => router.dismiss()} style={sty.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={sty.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={chords}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Ionicons name="musical-notes-outline" size={60} color={colors.border} />
            <Text style={sty.emptyText}>Nenhuma cifra nesta playlist.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={sty.item}
            onPress={() => router.push({
              pathname: '/chord/[id]',
              params: { id: item.id, playlistId: id },
            })}
            activeOpacity={0.7}
          >
            <View style={sty.numBadge}>
              <Text style={sty.numText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {item.moment ? (
                <Text style={sty.itemMoment} numberOfLines={1}>{item.moment}</Text>
              ) : null}
              <Text style={sty.itemName} numberOfLines={1}>{item.name}</Text>
              {item.artist ? (
                <Text style={sty.itemSub} numberOfLines={1}>{item.artist}</Text>
              ) : null}
            </View>
            <Text style={[sty.itemTone, { color: colors.accent }]}>
              {transposeTone(item.tone, item.tone_offset ?? 0)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.header,
      paddingHorizontal: 12, paddingVertical: 12,
    },
    backBtn: { width: 40, padding: 4 },
    headerTitle: {
      flex: 1, fontSize: 18, fontWeight: '700', color: c.text,
      textAlign: 'center', marginHorizontal: 8,
    },
    item: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1,
      borderColor: c.border, gap: 10,
    },
    numBadge: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    numText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    itemMoment: { fontSize: 10, fontWeight: '700', color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    itemName: { fontSize: 15, fontWeight: '600', color: c.text },
    itemSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
    itemTone: { fontSize: 13, fontWeight: '600', marginRight: 4 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: c.textSub, fontSize: 14, textAlign: 'center' },
  });
}
