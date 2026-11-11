/**
 * Correos del canal de solicitudes. Las plantillas (HTML con la identidad de
 * Studio Nomade + texto plano) viven en `email-templates/`; este módulo
 * mantiene el punto de entrada histórico. Módulo puro.
 */

export {
  ADJUSTMENTS_GUIDE,
  emailAssetsBase,
  escapeHtml,
  firstName,
  priorityStyle,
  renderAdjustmentsAckEmail,
  renderApprovedEmail,
  renderCommentAckEmail,
  renderConfirmationEmail,
  renderConsultaEmail,
  renderDeliveryEmail,
  renderEvaluationEmail,
  renderMonthlyReportEmail,
  monthlyReportLabel,
  monthlyReportSubject,
  stageFromEstado,
  stageSteps,
  type AdjustmentsAckInput,
  type ApprovedInput,
  type CommentAckInput,
  type ConfirmationInput,
  type ConsultaInput,
  type DeliveryFile,
  type DeliveryInput,
  type EvaluationInput,
  type FieldChange,
  type MonthlyReportIndicator,
  type MonthlyReportInput,
  type RenderedEmail,
  type Stage,
} from "./email-templates/render";
