import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DocumentItem } from '../../types';
import { formatShortDate } from '../../utils/formatters';

interface DocScanCardProps {
  document: DocumentItem;
  onPress: () => void;
  onPressOptions?: (doc: DocumentItem) => void;
}

export const DocScanCard: React.FC<DocScanCardProps> = ({
  document,
  onPress,
  onPressOptions,
}) => {
  const thumbUri = document.localUri || document.thumbnailUrl;
  const pageCount = (document as any).pageCount || ((document as any).pages?.length) || 1;
  const shortDate = formatShortDate(document.createdAt) || '11/17/2026';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Thumbnail Box */}
      <View style={styles.thumbBox}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderThumb}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <Path d="M14 2v6h6" />
              <Path d="M16 13H8" />
              <Path d="M16 17H8" />
            </Svg>
          </View>
        )}
      </View>

      {/* Info Column */}
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {document.name}
        </Text>

        <View style={styles.metaRow}>
          {/* Date */}
          <Text style={styles.dateText}>{shortDate}</Text>

          {/* Page Count Badge [ 1 ] */}
          <View style={styles.pageBadge}>
            <Text style={styles.pageBadgeText}>{pageCount}</Text>
          </View>

          {/* Blue Document Outline Icon */}
          <View style={styles.docIconBox}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <Path d="M14 2v6h6" />
              <Path d="M10 13h4" />
            </Svg>
          </View>
        </View>
      </View>

      {/* Action / Three Dots Button */}
      <TouchableOpacity
        style={styles.optionsBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          if (onPressOptions) {
            onPressOptions(document);
          } else {
            onPress();
          }
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Text style={styles.dotsText}>•••</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbBox: {
    width: 58,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
    fontWeight: '500',
  },
  pageBadge: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pageBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  docIconBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  dotsText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
