import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: '1 solid #ccc',
    paddingBottom: 10,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.4,
    color: '#444',
    marginBottom: 2,
  },
  listItem: {
    marginLeft: 10,
    fontSize: 11,
    marginBottom: 2,
  },
  preformatted: {
    fontSize: 10,
    fontFamily: 'Courier',
    backgroundColor: '#f6f6f6',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 8,
    maxHeight: 200,
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    fontSize: 50,
    color: '#ccc',
    opacity: 0.1,
    transform: 'rotate(-30deg)',
    zIndex: 0,
  },
});

const ReportPDF = ({ reportData }) => {
  const {
    symptoms = [],
    report = '',
    confidence = 0,
    groqConfidence,
    diagnosis = 'N/A',
    specialty = 'N/A',
    suggested_tests = [],
    recommendations = [],
    hideConfidence = false,
  } = reportData || {};
  const extractPercentFromText = (text) => {
    if (!text) return NaN;
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : NaN;
  };

  const sanitizeHiddenReportText = (text) => {
    if (!text) return text;
    return text
      .split('\n')
      .filter((line) => {
        const lowered = line.toLowerCase();
        return !lowered.includes('confidence') && !lowered.includes('probability');
      })
      .join('\n')
      .trim();
  };
  const reportTextConfidence = extractPercentFromText(report);
  const canonicalConfidence = hideConfidence
    ? null
    : (Number.isFinite(reportTextConfidence)
      ? reportTextConfidence
      : (Number.isFinite(Number(groqConfidence)) ? Number(groqConfidence) : (Number(confidence) || 0)));
  const displayConfidence = hideConfidence || canonicalConfidence === null
    ? null
    : Number(canonicalConfidence.toFixed(2));
  const syncedReportText = report
    ? (hideConfidence || displayConfidence === null
      ? sanitizeHiddenReportText(report)
      : report.replace(/(\d+(?:\.\d+)?)\s*%/, `${displayConfidence}%`))
    : '';

  const currentDate = new Date().toLocaleString();

  const getConfidenceComment = (score) => {
    if (score >= 85) return 'High confidence in diagnostic analysis.';
    if (score >= 70) return 'Moderate confidence. Consider further review if symptoms persist.';
    return 'Low confidence. Strongly recommend specialist consultation.';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        <Text style={styles.watermark}>MEDIVISION AI</Text>

        {/* Header */}
        <View style={styles.header}>
          <Image
            style={styles.logo}
            src="logo.png" // Replace with your logo URL
          />
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Diagnostic Report</Text>
            <Text style={styles.subtitle}>AI-Assisted Medical Summary</Text>
          </View>
        </View>

        {/* Diagnosis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Diagnosis</Text>
          <Text style={styles.text}>{diagnosis}</Text>
        </View>

        {/* Specialty */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Specialty</Text>
          <Text style={styles.text}>{specialty}</Text>
        </View>

        {/* Detailed Report */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Detailed Report</Text>
          {report ? (
            <Text style={styles.preformatted}>{hideConfidence ? report : syncedReportText}</Text>
          ) : (
            <Text style={styles.text}>No detailed report available.</Text>
          )}
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Detected Symptoms</Text>
          {symptoms.length ? symptoms.map((symptom, idx) => (
            <Text key={idx} style={styles.listItem}>• {symptom}</Text>
          )) : (
            <Text style={styles.text}>No symptoms detected.</Text>
          )}
        </View>

        {/* Suggested Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Recommended Tests</Text>
          {suggested_tests.length ? (
            suggested_tests.map((test, idx) => (
              <Text key={idx} style={styles.listItem}>• {test}</Text>
            ))
          ) : (
            <Text style={styles.text}>No recommended tests.</Text>
          )}
        </View>

        {!hideConfidence && displayConfidence !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Confidence Assessment</Text>
            <Text style={styles.text}>Confidence Score: {displayConfidence}%</Text>
            <Text style={styles.text}>{getConfidenceComment(displayConfidence)}</Text>
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{hideConfidence ? '6. Clinical Recommendations' : '7. Clinical Recommendations'}</Text>
          {recommendations.length ? (
            recommendations.map((rec, idx) => (
              <Text key={idx} style={styles.listItem}>• {rec}</Text>
            ))
          ) : (
            <Text style={styles.text}>No specific recommendations provided.</Text>
          )}
        </View>

        {/* Footer - Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{hideConfidence ? '7. Generated On' : '8. Generated On'}</Text>
          <Text style={styles.text}>{currentDate}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReportPDF;
