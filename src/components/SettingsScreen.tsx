import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSettings, DEFAULT_SETTINGS, BALL_RADIUS_MIN, BALL_RADIUS_MAX } from '../context/SettingsContext';

interface Props {
  onBack: () => void;
}

// Helper: render a single slider row
function SettingRow({
  label, labelKo, lang, value, min, max, step, format, onValueChange, desc,
}: {
  label: string;
  labelKo: string;
  lang: 'ko' | 'en';
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onValueChange: (v: number) => void;
  desc?: { en: string; ko: string };
}) {
  const [showDesc, setShowDesc] = useState(false);
  const [localValue, setLocalValue] = useState<number>(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const display = format ? format(localValue) : String(Math.round(localValue * 100) / 100);
  const displayLabel = lang === 'ko' ? labelKo : label;
  const displayDesc = desc ? (lang === 'ko' ? desc.ko : desc.en) : undefined;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{displayLabel}</Text>
        {lang === 'ko' ? null : <Text style={styles.rowLabelKo}>{''}</Text>}
        {desc && (
          <TouchableOpacity style={styles.helpBtn} onPress={() => setShowDesc(v => !v)}>
            <Text style={styles.helpBtnText}>{showDesc ? '✕' : '?'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.rowValue}>{display}</Text>
      </View>
      {showDesc && displayDesc && (
        <View style={styles.descBox}>
          <Text style={styles.descEn}>{displayDesc}</Text>
        </View>
      )}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={localValue}
        onValueChange={(v: number) => setLocalValue(v)}
        onSlidingComplete={(v: number) => onValueChange(v)}
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
  const lang = settings.language ?? 'en';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{settings.language === 'ko' ? '설정' : 'Settings'}</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={resetSettings}>
          <Text style={styles.resetText}>{settings.language === 'ko' ? '초기화' : 'Reset'}</Text>
        </TouchableOpacity>
      </View>

      {/* Language toggle */}
      <View style={{ padding: 12, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        <TouchableOpacity
          style={[styles.langBtn, settings.language === 'en' ? styles.langActive : null]}
          onPress={() => updateSetting('language', 'en')}
        >
          <Text style={{ color: settings.language === 'en' ? '#fff' : '#1b4332', fontWeight: '700' }}>EN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, settings.language === 'ko' ? styles.langActive : null]}
          onPress={() => updateSetting('language', 'ko')}
        >
          <Text style={{ color: settings.language === 'ko' ? '#fff' : '#1b4332', fontWeight: '700' }}>KO</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Ball Size ───────────────────────────────── */}
        <Text style={styles.section}>Ball Size  공 크기</Text>

        <SettingRow
          label="3-Cushion Ball Radius"
          labelKo="3쿠션 공 반지름"
          lang={lang}
          value={settings.ballRadius3C}
          min={BALL_RADIUS_MIN} max={BALL_RADIUS_MAX} step={1}
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
          lang={lang}
          value={settings.ballRadius4B}
          min={BALL_RADIUS_MIN} max={BALL_RADIUS_MAX} step={1}
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
          lang={lang}
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
          lang={lang}
          value={settings.friction3C}
          min={0.3} max={0.95} step={0.01}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('friction3C', v)}
          desc={{
            en: 'Per-second speed decay. Higher = less friction (rolls farther). Lower = more friction (stops sooner). Default 0.68.',
            ko: '초당 속도 감소 비율. 높을수록 마찰이 적어 더 멀리 굴러갑니다. 낮을수록 빨리 멈춥니다. 기본값 0.68.',
          }}
        />
        <SettingRow
          label="4-Ball Ball Friction"
          labelKo="사구 마찰"
          lang={lang}
          value={settings.friction4B}
          min={0.3} max={0.95} step={0.01}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('friction4B', v)}
          desc={{
            en: 'Per-second speed decay for the 4-Ball table. Higher = less friction (rolls farther). Default 0.68.',
            ko: '사구 테이블의 초당 속도 감소 비율. 높을수록 마찰이 적어 더 멀리 굴러갑니다. 기본값 0.68.',
          }}
        />

        {/* ── Launch ──────────────────────────────────── */}
        <Text style={styles.section}>Launch  발사</Text>

        <SettingRow
          label="Power Multiplier"
          labelKo="파워 배율"
          lang={lang}
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
          lang={lang}
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
          lang={lang}
          value={settings.launchSpeed4B}
          min={100} max={400} step={5}
          format={(v) => `${v}`}
          onValueChange={(v) => updateSetting('launchSpeed4B', v)}
          desc={{
            en: 'Base speed of the cue ball at full power on the 4-Ball table.',
            ko: '사구에서 최대 파워 발사 시 기본 속도.',
          }}
        />
        <SettingRow
          label="Power Meter Speed"
          labelKo="파워 미터 속도"
          lang={lang}
          value={settings.chargeCyclesPerSec}
          min={0.3} max={2.0} step={0.1}
          format={(v) => `${v.toFixed(1)} /s`}
          onValueChange={(v) => updateSetting('chargeCyclesPerSec', v)}
          desc={{
            en: 'How fast the power bar oscillates when aiming. Lower = easier to control.',
            ko: '조준 중 파워 바가 왕복하는 속도. 낮을수록 컨트롤이 쉽습니다.',
          }}
        />

        {/* ── Spin ────────────────────────────────────── */}
        <Text style={styles.section}>Spin  스핀</Text>

        <SettingRow
          label="Draw/Follow Transfer"
          labelKo="끌어/밀어치기 전달력"
          lang={lang}
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
          lang={lang}
          value={settings.englishFactor}
          min={0.1} max={0.8} step={0.02}
          format={(v) => v.toFixed(2)}
          onValueChange={(v) => updateSetting('englishFactor', v)}
          desc={{
            en: 'How strongly left/right English (side spin) deflects the cue ball off a cushion. Higher = more curve after cushion contact.',
            ko: '왼쪽/오른쪽 회전이 쿠션에서 공 방향을 바꾸는 강도. 높을수록 쿠션 후 더 많이 꺾입니다.',
          }}
        />

        {/* ── Stopping ─────────────────────────────────── */}
        <Text style={styles.section}>Stopping  정지</Text>

        <SettingRow
          label="Stop Drag"
          labelKo="정지 감속"
          lang={lang}
          value={settings.stopDrag}
          min={0} max={10} step={1}
          format={(v) => `${v} px/s²`}
          onValueChange={(v) => updateSetting('stopDrag', v)}
          desc={{
            en: 'Extra linear deceleration applied at all speeds. Higher = balls stop sooner. Does not affect initial shot feel.',
            ko: '모든 속도에서 추가로 적용되는 선형 감속. 높을수록 공이 더 빨리 멈춥니다. 초기 발사 느낌에는 영향이 없습니다.',
          }}
        />

        {/* ── Trajectory ─────────────────────────────────── */}
        <Text style={styles.section}>Trajectory  궤적</Text>

        <SettingRow
          label="Trajectory Length"
          labelKo="궤적 길이"
          lang={lang}
          value={settings.trajectoryLength}
          min={10} max={120} step={10}
          format={(v) => `${v} px`}
          onValueChange={(v) => updateSetting('trajectoryLength', v)}
          desc={{
            en: 'Length of the trajectory preview line in pixels.',
            ko: '궤적 미리보기 선의 길이(픽셀 단위).',
          }}
        />

        {/* ── Game Rules ─────────────────────────────────── */}
        <Text style={styles.section}>Game Rules  게임 규칙</Text>

        <SettingRow
          label="3-Cushion Win Score"
          labelKo="3쿠션 목표 점수"
          lang={lang}
          value={settings.winScore3C}
          min={3} max={20} step={1}
          format={(v) => `${v} pts`}
          onValueChange={(v) => updateSetting('winScore3C', v)}
          desc={{
            en: 'Points needed to win a 3-Cushion game. First player to reach this score wins.',
            ko: '3쿠션 게임에서 승리하기 위해 필요한 점수. 먼저 이 점수에 도달한 플레이어가 승리합니다.',
          }}
        />
        <SettingRow
          label="4-Ball Win Score"
          labelKo="사구 목표 점수"
          lang={lang}
          value={settings.winScore4B}
          min={3} max={20} step={1}
          format={(v) => `${v} pts`}
          onValueChange={(v) => updateSetting('winScore4B', v)}
          desc={{
            en: 'Points needed to win a 4-Ball (사구) game. First player to reach this score wins.',
            ko: '사구 게임에서 승리하기 위해 필요한 점수. 먼저 이 점수에 도달한 플레이어가 승리합니다.',
          }}
        />

        {/* ── Audio ─────────────────────────────────────── */}
        <Text style={styles.section}>Audio  오디오</Text>

          <View style={[styles.row, { paddingBottom: 6 }]}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{settings.language === 'ko' ? '배경음' : 'Background Music'}</Text>
              <Text style={styles.rowValue} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Switch
                value={settings.bmEnabled ?? false}
                onValueChange={(v) => updateSetting('bmEnabled', v)}
                trackColor={{ true: '#2cc47a', false: '#ccc' }}
                thumbColor={(settings.bmEnabled ?? false) ? '#fff' : '#fff'}
              />
              <Text style={styles.bmToggleText}>
                {(settings.bmEnabled ?? false) ? (settings.language === 'ko' ? '켜짐' : 'On') : (settings.language === 'ko' ? '끔' : 'Off')}
              </Text>
            </View>
          </View>

        {(settings.bmEnabled ?? false) ? (
          <SettingRow
            label="Background Music Volume"
            labelKo="배경음 볼륨"
            lang={lang}
            value={settings.bmVolume ?? 0.2}
            min={0.0} max={1.0} step={0.01}
            format={(v) => `${Math.round(v * 100)} %`}
            onValueChange={(v) => updateSetting('bmVolume', v)}
            desc={{
              en: 'Volume level for background mood sound.',
              ko: '게임 플레이중 재생되는 배경음의 볼륨 레벨.',
            }}
          />
        ) : null}

        {/* Default values reference */}
        <View style={styles.defaults}>
          <Text style={styles.defaultsTitle}>Default Values  기본값</Text>
          {(Object.entries(DEFAULT_SETTINGS) as [string, any][]).map(([k, v]) => {
            let displayVal: string | number = v as any;
            if (typeof v === 'boolean') displayVal = v ? 'true' : 'false';
            else if (typeof v === 'number' && v % 1 !== 0) displayVal = v.toFixed(4);
            return (
              <Text key={k} style={styles.defaultItem}>
                {k}: <Text style={styles.defaultVal}>{String(displayVal)}</Text>
              </Text>
            );
          })}
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
  langBtn: {
    width: 68, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e8e8',
  },
  langActive: { backgroundColor: '#1b4332' },
  bmToggleText: { marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#1b4332' },
});
