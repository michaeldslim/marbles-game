import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSettings, DEFAULT_SETTINGS } from '../context/SettingsContext';

interface Props {
  onBack: () => void;
}

// Helper: render a single slider row
function SettingRow({
  label, labelKo, value, min, max, step, format, onValueChange, desc,
}: {
  label: string;
  labelKo: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onValueChange: (v: number) => void;
  desc?: { en: string; ko: string };
}) {
  const [showDesc, setShowDesc] = useState(false);
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowLabelKo}>{labelKo}</Text>
        {desc && (
          <TouchableOpacity style={styles.helpBtn} onPress={() => setShowDesc(v => !v)}>
            <Text style={styles.helpBtnText}>{showDesc ? '✕' : '?'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.rowValue}>{display}</Text>
      </View>
      {showDesc && desc && (
        <View style={styles.descBox}>
          <Text style={styles.descEn}>{desc.en}</Text>
          <Text style={styles.descKo}>{desc.ko}</Text>
        </View>
      )}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="#2cc47a"
        maximumTrackTintColor="#ccc"
        thumbTintColor="#2cc47a"
      />
      <View style={styles.minMax}>
        <Text style={styles.minMaxText}>{min}</Text>
        <Text style={styles.minMaxText}>{max}</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen({ onBack }: Props): JSX.Element {
  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings  설정</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={resetSettings}>
          <Text style={styles.resetText}>Reset  초기화</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Ball Size ───────────────────────────────── */}
        <Text style={styles.section}>Ball Size  공 크기</Text>

        <SettingRow
          label="3-Cushion Ball Radius"
          labelKo="3쿠션 공 반지름"
          value={settings.ballRadius3C}
          min={10} max={20} step={1}
          format={(v) => `${v} px`}
          onValueChange={(v) => updateSetting('ballRadius3C', v)}
          desc={{
            en: 'Radius of each ball on the 3-Cushion table. Larger = easier to hit; smaller = more realistic.',
            ko: '3쿠션 테이블 공의 반지름. 크면 맞히기 쉽고, 작으면 더 사실적입니다.',
          }}
        />
        <SettingRow
          label="4-Ball Ball Radius"
          labelKo="사구 공 반지름"
          value={settings.ballRadius4B}
          min={10} max={20} step={1}
          format={(v) => `${v} px`}
          onValueChange={(v) => updateSetting('ballRadius4B', v)}
          desc={{
            en: 'Radius of each ball on the 4-Ball (사구) table.',
            ko: '사구 테이블 공의 반지름.',
          }}
        />

        {/* ── Physics ─────────────────────────────────── */}
        <Text style={styles.section}>Physics  물리</Text>

        <SettingRow
          label="Restitution (Bounciness)"
          labelKo="반발계수 (탄성)"
          value={settings.restitution}
          min={0.5} max={1.0} step={0.01}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('restitution', v)}
          desc={{
            en: 'How bouncy balls are after hitting a cushion or another ball. 1.0 = perfectly elastic (no energy loss). 0.5 = heavy energy loss.',
            ko: '쿠션이나 공 충돌 후 튕기는 정도. 1.0 = 완전 탄성(에너지 손실 없음), 0.5 = 에너지 손실 큼.',
          }}
        />
        <SettingRow
          label="3-Cushion Ball Friction"
          labelKo="3쿠션 마찰"
          value={settings.friction3C}
          min={0.97} max={0.9999} step={0.001}
          format={(v) => v.toFixed(4)}
          onValueChange={(v) => updateSetting('friction3C', v)}
          desc={{
            en: 'How quickly balls slow down while rolling. Values closer to 1.0 = less friction (ball rolls farther).',
            ko: '공이 구를 때 속도가 줄어드는 비율. 1.0에 가까울수록 마찰이 적어 더 멀리 굴러갑니다.',
          }}
        />
        <SettingRow
          label="4-Ball Ball Friction"
          labelKo="사구 마찰"
          value={settings.friction4B}
          min={0.97} max={0.9999} step={0.001}
          format={(v) => v.toFixed(4)}
          onValueChange={(v) => updateSetting('friction4B', v)}
          desc={{
            en: 'Same as above but applied to the 4-Ball table.',
            ko: '사구 테이블에서의 마찰 계수.',
          }}
        />

        {/* ── Launch ──────────────────────────────────── */}
        <Text style={styles.section}>Launch  발사</Text>

        <SettingRow
          label="Power Multiplier"
          labelKo="파워 배율"
          value={settings.playerPower}
          min={1.0} max={10.0} step={0.5}
          format={(v) => `×${v.toFixed(1)}`}
          onValueChange={(v) => updateSetting('playerPower', v)}
          desc={{
            en: 'Multiplied with the launch speed on every shot. Higher = harder shots overall.',
            ko: '모든 샷의 발사 속도에 곱해지는 배율. 높을수록 전체적으로 더 세게 칩니다.',
          }}
        />
        <SettingRow
          label="3-Cushion Launch Speed"
          labelKo="3쿠션 발사 속도"
          value={settings.launchSpeed3C}
          min={100} max={400} step={5}
          format={(v) => `${v}`}
          onValueChange={(v) => updateSetting('launchSpeed3C', v)}
          desc={{
            en: 'Base speed of the cue ball at full power on the 3-Cushion table. Actual speed = Launch Speed × Power Multiplier.',
            ko: '3쿠션에서 최대 파워 발사 시 기본 속도. 실제 속도 = 발사 속도 × 파워 배율.',
          }}
        />
        <SettingRow
          label="4-Ball Launch Speed"
          labelKo="사구 발사 속도"
          value={settings.launchSpeed4B}
          min={100} max={400} step={5}
          format={(v) => `${v}`}
          onValueChange={(v) => updateSetting('launchSpeed4B', v)}
          desc={{
            en: 'Base speed of the cue ball at full power on the 4-Ball table.',
            ko: '사구에서 최대 파워 발사 시 기본 속도.',
          }}
        />

        {/* ── Spin ────────────────────────────────────── */}
        <Text style={styles.section}>Spin  스핀</Text>

        <SettingRow
          label="Draw/Follow Transfer"
          labelKo="끌어/밀어치기 전달력"
          value={settings.spinTransfer}
          min={0.1} max={1.0} step={0.05}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('spinTransfer', v)}
          desc={{
            en: 'Strength of draw (backspin/끌어치기) and follow (topspin/밀어치기) after the cue ball hits an object ball. Higher = more dramatic deflection.',
            ko: '충돌 후 끌어치기(역회전)·밀어치기(순회전)가 공 경로에 영향을 주는 강도. 높을수록 효과가 강합니다.',
          }}
        />
        <SettingRow
          label="English Factor"
          labelKo="회전(English) 강도"
          value={settings.englishFactor}
          min={0.1} max={0.8} step={0.02}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('englishFactor', v)}
          desc={{
            en: 'How strongly left/right English (side spin) deflects the cue ball off a cushion. Higher = more curve after cushion contact.',
            ko: '왼쪽/오른쪽 회전이 쿠션에서 공 방향을 바꾸는 강도. 높을수록 쿠션 후 더 많이 꺾입니다.',
          }}
        />

        {/* Default values reference */}
        <View style={styles.defaults}>
          <Text style={styles.defaultsTitle}>Default Values  기본값</Text>
          {(Object.entries(DEFAULT_SETTINGS) as [string, number][]).map(([k, v]) => (
            <Text key={k} style={styles.defaultItem}>
              {k}: <Text style={styles.defaultVal}>{typeof v === 'number' && v % 1 !== 0 ? v.toFixed(4) : v}</Text>
            </Text>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: '#1b4332', gap: 8,
  },
  backBtn: {
    width: 34, height: 34, backgroundColor: '#2d6a4f',
    borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  resetBtn: {
    backgroundColor: '#e44', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  resetText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  scroll: { padding: 16, paddingBottom: 40 },

  section: {
    fontSize: 13, fontWeight: '800', color: '#1b4332',
    marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  row: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#222' },
  rowLabelKo: { fontSize: 11, color: '#888', marginRight: 4 },
  helpBtn: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  helpBtnText: { fontSize: 11, fontWeight: '700', color: '#2d6a4f', lineHeight: 13 },
  descBox: {
    backgroundColor: '#e8f5ee', borderRadius: 6, padding: 8,
    marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#2cc47a',
  },
  descEn: { fontSize: 12, color: '#1b4332', marginBottom: 3, lineHeight: 17 },
  descKo: { fontSize: 12, color: '#2d6a4f', lineHeight: 17 },
  rowValue: {
    fontSize: 13, fontWeight: '800', color: '#1b4332',
    minWidth: 52, textAlign: 'right',
  },
  slider: { width: '100%', height: 32 },
  minMax: { flexDirection: 'row', justifyContent: 'space-between' },
  minMaxText: { fontSize: 10, color: '#bbb' },

  defaults: {
    marginTop: 24, backgroundColor: '#f0f0f0', borderRadius: 10,
    padding: 12,
  },
  defaultsTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  defaultItem: { fontSize: 11, color: '#666', marginBottom: 2 },
  defaultVal: { fontWeight: '700', color: '#333' },
});
