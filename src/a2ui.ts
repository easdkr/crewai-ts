export type A2UIRecord = Record<string, unknown>;

export class A2UIModel {
  constructor(options: A2UIRecord = {}) {
    Object.assign(this, options);
    defineSnakeAliases(this, options);
  }

  modelDump(): A2UIRecord {
    return Object.fromEntries(Object.entries(this));
  }

  model_dump(): A2UIRecord {
    return this.modelDump();
  }

  static modelValidate<T extends A2UIModel>(this: new (options?: A2UIRecord) => T, value: unknown): T {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${this.name}.modelValidate requires an object.`);
    }
    return new this(value as A2UIRecord);
  }

  static model_validate<T extends A2UIModel>(this: new (options?: A2UIRecord) => T, value: unknown): T {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("model_validate requires an object.");
    }
    return new this(value as A2UIRecord);
  }
}

export const StylesDict = Object.freeze({ kind: "StylesDict" });
export const ComponentEntryDict = Object.freeze({ kind: "ComponentEntryDict" });
export const BeginRenderingDict = Object.freeze({ kind: "BeginRenderingDict" });
export const SurfaceUpdateDict = Object.freeze({ kind: "SurfaceUpdateDict" });
export const DataEntryDict = Object.freeze({ kind: "DataEntryDict" });
export const DataModelUpdateDict = Object.freeze({ kind: "DataModelUpdateDict" });
export const DeleteSurfaceDict = Object.freeze({ kind: "DeleteSurfaceDict" });
export const A2UIMessageDict = Object.freeze({ kind: "A2UIMessageDict" });
export const ThemeDict = Object.freeze({ kind: "ThemeDict" });
export const CreateSurfaceDict = Object.freeze({ kind: "CreateSurfaceDict" });
export const UpdateComponentsDict = Object.freeze({ kind: "UpdateComponentsDict" });
export const UpdateDataModelDict = Object.freeze({ kind: "UpdateDataModelDict" });
export const DeleteSurfaceV09Dict = Object.freeze({ kind: "DeleteSurfaceV09Dict" });
export const A2UIMessageV09Dict = Object.freeze({ kind: "A2UIMessageV09Dict" });
export const A2UIAnyMessageDict = Object.freeze({ kind: "A2UIAnyMessageDict" });

export const IconName = [
  "accountCircle", "add", "arrowBack", "arrowForward", "attachFile", "calendarToday",
  "call", "camera", "check", "close", "delete", "download", "edit", "event", "error",
  "favorite", "favoriteOff", "folder", "help", "home", "info", "locationOn", "lock",
  "lockOpen", "mail", "menu", "moreVert", "moreHoriz", "notificationsOff",
  "notifications", "payment", "person", "phone", "photo", "print", "refresh", "search",
  "send", "settings", "share", "shoppingCart", "star", "starHalf", "starOff", "upload",
  "visibility", "visibilityOff", "warning",
] as const;

export const IconNameV09 = [
  ...IconName,
  "fastForward", "pause", "play", "rewind", "skipNext", "skipPrevious", "stop",
  "volumeDown", "volumeMute", "volumeOff", "volumeUp",
] as const;

export const ComponentName = [
  "Text", "Image", "Icon", "Video", "AudioPlayer", "Row", "Column", "List", "Card",
  "Tabs", "Modal", "Divider", "Button", "TextField", "CheckBox", "ChoicePicker",
  "Slider", "DateTimeInput",
] as const;

export const FunctionName = [
  "required", "regex", "length", "numeric", "email", "formatString", "formatNumber",
  "formatCurrency", "formatDate", "pluralize", "openUrl", "and", "or", "not",
] as const;

export const STANDARD_CATALOG_COMPONENTS = new Set([
  "Text", "Image", "Icon", "Video", "AudioPlayer", "Row", "Column", "List", "Card",
  "Tabs", "Divider", "Modal", "Button", "CheckBox", "TextField", "DateTimeInput",
  "MultipleChoice", "Slider",
]);
const STANDARD_CATALOG_REQUIRED_FIELDS: Record<string, readonly (readonly string[])[]> = {
  Text: [["text"]],
  Image: [["url"]],
  Icon: [["name"]],
  Video: [["url"]],
  AudioPlayer: [["url"]],
  Row: [["children"]],
  Column: [["children"]],
  List: [["children"]],
  Card: [["child"]],
  Tabs: [["tabItems", "tab_items"]],
  Modal: [["entryPointChild", "entry_point_child"], ["contentChild", "content_child"]],
  Button: [["child"], ["action"]],
  CheckBox: [["label"], ["value"]],
  TextField: [["label"]],
  DateTimeInput: [["value"]],
  MultipleChoice: [["selections"], ["options"]],
  Slider: [["value"]],
};
export const BASIC_CATALOG_COMPONENTS = new Set(ComponentName);
export const BASIC_CATALOG_FUNCTIONS = new Set(FunctionName);
export const V09_ICON_NAMES = new Set(IconNameV09);

export class StringBinding extends A2UIModel {}
export class NumberBinding extends A2UIModel {}
export class BooleanBinding extends A2UIModel {}
export class ArrayBinding extends A2UIModel {}
export class ChildrenDef extends A2UIModel {}
export class ChildTemplate extends A2UIModel {}
export class ActionContextEntry extends A2UIModel {}
export class ActionBoundValue extends A2UIModel {}
export class Action extends A2UIModel {}
export class TabItem extends A2UIModel {}
export class MultipleChoiceOption extends A2UIModel {}
export class Text extends A2UIModel {}
export class Image extends A2UIModel {}
export class IconBinding extends A2UIModel {}
export class Icon extends A2UIModel {}
export class Video extends A2UIModel {}
export class AudioPlayer extends A2UIModel {}
export class Row extends A2UIModel {}
export class Column extends A2UIModel {}
export class List extends A2UIModel {}
export class Card extends A2UIModel {}
export class Tabs extends A2UIModel {}
export class Divider extends A2UIModel {}
export class Modal extends A2UIModel {}
export class Button extends A2UIModel {}
export class CheckBox extends A2UIModel {}
export class TextField extends A2UIModel {}
export class DateTimeInput extends A2UIModel {}
export class MultipleChoice extends A2UIModel {}
export class Slider extends A2UIModel {}

export class BoundValue extends A2UIModel {}
export class MapEntry extends A2UIModel {}
export class DataEntry extends A2UIModel {}
export class Styles extends A2UIModel {}
export class ComponentEntry extends A2UIModel {}
export class BeginRendering extends A2UIModel {}
export class SurfaceUpdate extends A2UIModel {}
export class DataModelUpdate extends A2UIModel {}
export class DeleteSurface extends A2UIModel {}
export class UserAction extends A2UIModel {}
export class ClientError extends A2UIModel {}
export class A2UIResponse extends A2UIModel {}

export class A2UIMessage extends A2UIModel {
  constructor(options: A2UIRecord = {}) {
    super(options);
    assertExactlyOne(options, ["beginRendering", "begin_rendering", "surfaceUpdate", "surface_update", "dataModelUpdate", "data_model_update", "deleteSurface", "delete_surface"], "A2UI message type");
  }
}

export class A2UIEvent extends A2UIModel {
  constructor(options: A2UIRecord = {}) {
    super(options);
    assertExactlyOne(options, ["userAction", "user_action", "error"], "A2UI event type");
  }
}

export class DataBinding extends A2UIModel {}
export class FunctionCall extends A2UIModel {}
export const DynamicValue = Object.freeze({ kind: "DynamicValue" });
export const DynamicString = Object.freeze({ kind: "DynamicString" });
export const DynamicNumber = Object.freeze({ kind: "DynamicNumber" });
export const DynamicBoolean = Object.freeze({ kind: "DynamicBoolean" });
export const DynamicStringList = Object.freeze({ kind: "DynamicStringList" });
export class CheckRule extends A2UIModel {}
export class AccessibilityAttributes extends A2UIModel {}
export const ChildListV09 = Object.freeze({ kind: "ChildListV09" });
export class EventAction extends A2UIModel {}
export class ActionV09 extends A2UIModel {}
export class TextV09 extends A2UIModel {}
export class ImageV09 extends A2UIModel {}
export class IconV09 extends A2UIModel {}
export class VideoV09 extends A2UIModel {}
export class AudioPlayerV09 extends A2UIModel {}
export class RowV09 extends A2UIModel {}
export class ColumnV09 extends A2UIModel {}
export class ListV09 extends A2UIModel {}
export class CardV09 extends A2UIModel {}
export class TabItemV09 extends A2UIModel {}
export class TabsV09 extends A2UIModel {}
export class ModalV09 extends A2UIModel {}
export class DividerV09 extends A2UIModel {}
export class ButtonV09 extends A2UIModel {}
export class TextFieldV09 extends A2UIModel {}
export class CheckBoxV09 extends A2UIModel {}
export class ChoicePickerOption extends A2UIModel {}
export class ChoicePickerV09 extends A2UIModel {}
export class SliderV09 extends A2UIModel {}
export class DateTimeInputV09 extends A2UIModel {}
export class Theme extends A2UIModel {}
export class CreateSurface extends A2UIModel {}
export class UpdateComponents extends A2UIModel {}
export class UpdateDataModel extends A2UIModel {}
export class DeleteSurfaceV09 extends A2UIModel {}
export class ActionEvent extends A2UIModel {}
export class ClientErrorV09 extends A2UIModel {}
export class ClientDataModel extends A2UIModel {}

export class A2UIMessageV09 extends A2UIModel {
  readonly version: "v0.9";

  constructor(options: A2UIRecord = {}) {
    super({ version: "v0.9", ...options });
    this.version = "v0.9";
    assertExactlyOne(options, ["createSurface", "create_surface", "updateComponents", "update_components", "updateDataModel", "update_data_model", "deleteSurface", "delete_surface"], "A2UI v0.9 message type");
  }
}

export class A2UIEventV09 extends A2UIModel {
  readonly version: "v0.9";

  constructor(options: A2UIRecord = {}) {
    super({ version: "v0.9", ...options });
    this.version = "v0.9";
    assertExactlyOne(options, ["action", "error"], "A2UI v0.9 event type");
  }
}

export function extractA2UIJsonObjects(text: string): A2UIRecord[] {
  return extractJsonObjectsWithKeys(text, ["beginRendering", "surfaceUpdate", "dataModelUpdate", "deleteSurface"]);
}

export const extract_a2ui_json_objects = extractA2UIJsonObjects;

export function extractA2UIV09JsonObjects(text: string): A2UIRecord[] {
  return extractJsonObjectsWithKeys(text, ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"]);
}

export const extract_a2ui_v09_json_objects = extractA2UIV09JsonObjects;

export const A2UI_MIME_TYPE = "application/json+a2ui";
export const A2UI_EXTENSION_URI = "https://a2ui.org/a2a-extension/a2ui/v0.8";
export const A2UI_STANDARD_CATALOG_ID = "https://a2ui.org/specification/v0_8/standard_catalog_definition.json";
export const A2UI_V09_EXTENSION_URI = "https://a2ui.org/a2a-extension/a2ui/v0.9";
export const A2UI_V09_BASIC_CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";

export function isV09Message(message: A2UIRecord): boolean {
  return message.version === "v0.9";
}

export const is_v09_message = isV09Message;

export function isV08Message(message: A2UIRecord): boolean {
  return !("version" in message);
}

export const is_v08_message = isV08Message;

export class A2UIConversationState {
  activeSurfaces: Record<string, A2UIRecord>;
  active_surfaces: Record<string, A2UIRecord>;
  dataModels: Record<string, A2UIRecord[]>;
  data_models: Record<string, A2UIRecord[]>;
  lastA2uiMessages: A2UIRecord[];
  last_a2ui_messages: A2UIRecord[];
  initializedSurfaces: Set<string>;
  initialized_surfaces: Set<string>;

  constructor(options: {
    activeSurfaces?: Record<string, A2UIRecord>;
    active_surfaces?: Record<string, A2UIRecord>;
    dataModels?: Record<string, A2UIRecord[]>;
    data_models?: Record<string, A2UIRecord[]>;
    lastA2uiMessages?: A2UIRecord[];
    last_a2ui_messages?: A2UIRecord[];
    initializedSurfaces?: Iterable<string>;
    initialized_surfaces?: Iterable<string>;
  } = {}) {
    this.activeSurfaces = options.activeSurfaces ?? options.active_surfaces ?? {};
    this.active_surfaces = this.activeSurfaces;
    this.dataModels = options.dataModels ?? options.data_models ?? {};
    this.data_models = this.dataModels;
    this.lastA2uiMessages = options.lastA2uiMessages ?? options.last_a2ui_messages ?? [];
    this.last_a2ui_messages = this.lastA2uiMessages;
    this.initializedSurfaces = new Set(options.initializedSurfaces ?? options.initialized_surfaces ?? []);
    this.initialized_surfaces = this.initializedSurfaces;
  }

  isReady(): boolean {
    return this.initializedSurfaces.size > 0;
  }

  is_ready(): boolean {
    return this.isReady();
  }
}

export class A2UIValidationError extends Error {
  readonly errors: readonly unknown[];

  constructor(message: string, errors: readonly unknown[] = []) {
    super(message);
    this.name = "A2UIValidationError";
    this.errors = errors;
  }
}

export function validateA2UIMessage(data: A2UIRecord, options: { validateCatalog?: boolean; validate_catalog?: boolean } = {}): A2UIMessage {
  try {
    const message = A2UIMessage.modelValidate(data);
    if (options.validateCatalog ?? options.validate_catalog) {
      validateCatalogComponents(message);
    }
    return message;
  } catch (error) {
    throw toValidationError(error, "Invalid A2UI message");
  }
}

export const validate_a2ui_message = validateA2UIMessage;

export function validateA2UIEvent(data: A2UIRecord): A2UIEvent {
  try {
    return A2UIEvent.modelValidate(data);
  } catch (error) {
    throw toValidationError(error, "Invalid A2UI event");
  }
}

export const validate_a2ui_event = validateA2UIEvent;

export function validateA2UIMessageV09(data: A2UIRecord): A2UIMessageV09 {
  try {
    return A2UIMessageV09.modelValidate(data);
  } catch (error) {
    throw toValidationError(error, "Invalid A2UI v0.9 message");
  }
}

export const validate_a2ui_message_v09 = validateA2UIMessageV09;

export function validateA2UIEventV09(data: A2UIRecord): A2UIEventV09 {
  try {
    return A2UIEventV09.modelValidate(data);
  } catch (error) {
    throw toValidationError(error, "Invalid A2UI v0.9 event");
  }
}

export const validate_a2ui_event_v09 = validateA2UIEventV09;

export function validateCatalogComponents(message: A2UIMessage): void {
  const messageRecord = message as unknown as A2UIRecord;
  const update = messageRecord.surfaceUpdate ?? messageRecord.surface_update;
  const components = isRecord(update) ? update.components : null;
  if (!Array.isArray(components)) {
    return;
  }
  const errors = components
    .filter((entry) => entry && typeof entry === "object")
    .flatMap((entry) => {
      const component = (entry as A2UIRecord).component;
      if (!isRecord(component)) {
        return [];
      }
      return Object.entries(component).flatMap(([name, props]) => {
        if (!STANDARD_CATALOG_COMPONENTS.has(name)) {
          return [];
        }
        return missingRequiredCatalogFields(name, props).map((field) => ({
          component_id: (entry as A2UIRecord).id ?? "<unknown>",
          component_type: name,
          field,
          message: `Field '${field}' is required`,
        }));
      });
    });
  if (errors.length > 0) {
    throw new A2UIValidationError(`Catalog validation failed: ${String(errors.length)} error(s)`, errors);
  }
}

export const validate_catalog_components = validateCatalogComponents;

export function validateCatalogComponentsV09(message: A2UIMessageV09): void {
  const messageRecord = message as unknown as A2UIRecord;
  const update = messageRecord.updateComponents ?? messageRecord.update_components;
  const components = isRecord(update) ? update.components : null;
  if (!Array.isArray(components)) {
    return;
  }
  const errors = components
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => (entry as A2UIRecord).component)
    .filter((name) => typeof name === "string" && !BASIC_CATALOG_COMPONENTS.has(name as typeof ComponentName[number]));
  if (errors.length > 0) {
    throw new A2UIValidationError(`v0.9 catalog validation failed: ${String(errors.length)} error(s)`, errors);
  }
}

export const validate_catalog_components_v09 = validateCatalogComponentsV09;

export class A2UIClientExtension {
  private readonly catalogId: string | null;
  private readonly allowedComponents: readonly string[] | null;
  private readonly version: string;

  constructor(catalogId: string | null = null, allowedComponents: readonly string[] | null = null, version = "v0.8") {
    this.catalogId = catalogId;
    this.allowedComponents = allowedComponents;
    this.version = version;
  }

  injectTools(_agent: unknown): void {
    void _agent;
  }

  inject_tools(agent: unknown): void {
    this.injectTools(agent);
  }

  extractStateFromHistory(conversationHistory: readonly { parts?: readonly { root?: { kind?: string; metadata?: A2UIRecord | null; data?: unknown } }[] }[]): A2UIConversationState | null {
    const state = new A2UIConversationState();
    for (const message of conversationHistory) {
      for (const part of message.parts ?? []) {
        const root = part.root;
        if (root?.kind !== "data" || root.metadata?.mimeType !== A2UI_MIME_TYPE || !isRecord(root.data)) {
          continue;
        }
        if (!this.shouldTrackCatalog(root.data)) {
          continue;
        }
        this.applyMessageToState(root.data, state);
      }
    }
    return Object.keys(state.activeSurfaces).length > 0 || Object.keys(state.dataModels).length > 0 ? state : null;
  }

  extract_state_from_history(conversationHistory: readonly { parts?: readonly { root?: { kind?: string; metadata?: A2UIRecord | null; data?: unknown } }[] }[]): A2UIConversationState | null {
    return this.extractStateFromHistory(conversationHistory);
  }

  augmentPrompt(basePrompt: string, _conversationState: A2UIConversationState | null = null): string {
    void _conversationState;
    const catalogId = this.catalogId ?? (this.version === "v0.9" ? A2UI_V09_BASIC_CATALOG_ID : A2UI_STANDARD_CATALOG_ID);
    const components = this.allowedComponents?.length ? ` Allowed components: ${this.allowedComponents.join(", ")}.` : "";
    return `${basePrompt}\n\nGenerate A2UI ${this.version} JSON messages using catalog ${catalogId}.${components}`;
  }

  augment_prompt(basePrompt: string, conversationState: A2UIConversationState | null = null): string {
    return this.augmentPrompt(basePrompt, conversationState);
  }

  processResponse(agentResponse: unknown, conversationState: A2UIConversationState | null = null): unknown {
    const text = typeof agentResponse === "string" ? agentResponse : String(agentResponse);
    let results = this.version === "v0.9"
      ? extractA2UIV09JsonObjects(text).map((message) => validateA2UIMessageV09(message).modelDump())
      : extractA2UIJsonObjects(text).map((message) => validateA2UIMessage(message).modelDump());
    if (this.allowedComponents?.length) {
      const allowed = new Set(this.allowedComponents);
      results = results.map((message) => this.version === "v0.9" ? filterComponentsV09(message, allowed) : filterComponents(message, allowed));
    }
    if (results.length > 0 && conversationState) {
      conversationState.lastA2uiMessages = results;
      conversationState.last_a2ui_messages = results;
    }
    return agentResponse;
  }

  process_response(agentResponse: unknown, conversationState: A2UIConversationState | null = null): unknown {
    return this.processResponse(agentResponse, conversationState);
  }

  prepareMessageMetadata(_conversationState: A2UIConversationState | null = null): A2UIRecord {
    void _conversationState;
    if (this.version === "v0.9") {
      const catalogIds = [A2UI_V09_BASIC_CATALOG_ID];
      if (this.catalogId && this.catalogId !== A2UI_V09_BASIC_CATALOG_ID) {
        catalogIds.push(this.catalogId);
      }
      return { a2uiClientCapabilities: { "v0.9": { supportedCatalogIds: catalogIds } } };
    }
    const catalogIds = [A2UI_STANDARD_CATALOG_ID];
    if (this.catalogId && this.catalogId !== A2UI_STANDARD_CATALOG_ID) {
      catalogIds.push(this.catalogId);
    }
    return { a2uiClientCapabilities: { supportedCatalogIds: catalogIds } };
  }

  prepare_message_metadata(conversationState: A2UIConversationState | null = null): A2UIRecord {
    return this.prepareMessageMetadata(conversationState);
  }

  private applyMessageToState(data: A2UIRecord, state: A2UIConversationState): void {
    const surfaceId = getSurfaceId(data);
    if (!surfaceId) {
      return;
    }
    if ("deleteSurface" in data) {
      state.activeSurfaces = Object.fromEntries(Object.entries(state.activeSurfaces).filter(([key]) => key !== surfaceId));
      state.active_surfaces = state.activeSurfaces;
      state.dataModels = Object.fromEntries(Object.entries(state.dataModels).filter(([key]) => key !== surfaceId));
      state.data_models = state.dataModels;
      state.initializedSurfaces.delete(surfaceId);
      return;
    }
    for (const key of ["beginRendering", "createSurface", "surfaceUpdate", "updateComponents"]) {
      const value = data[key];
      if (isRecord(value)) {
        state.activeSurfaces[surfaceId] = value;
        if (key === "beginRendering" || key === "createSurface") {
          state.initializedSurfaces.add(surfaceId);
        }
      }
    }
    for (const key of ["dataModelUpdate", "updateDataModel"]) {
      const value = data[key];
      if (isRecord(value)) {
        state.dataModels[surfaceId] ??= [];
        state.dataModels[surfaceId].push(value);
      }
    }
  }

  private shouldTrackCatalog(data: A2UIRecord): boolean {
    if (!this.catalogId) {
      return true;
    }
    const beginRendering = data.beginRendering;
    if (isRecord(beginRendering)) {
      const catalogId = beginRendering.catalogId;
      return typeof catalogId !== "string" || catalogId === this.catalogId;
    }
    const createSurface = data.createSurface;
    if (isRecord(createSurface)) {
      const catalogId = createSurface.catalogId;
      return typeof catalogId !== "string" || catalogId === this.catalogId;
    }
    return true;
  }
}

export class A2UIServerExtension {
  uri: string;
  readonly required = false;
  readonly description = "A2UI declarative UI generation";
  private readonly catalogIds: readonly string[];
  private readonly acceptInlineCatalogs: boolean;
  private readonly version: string;

  constructor(catalogIds: readonly string[] | null = null, acceptInlineCatalogs = false, version = "v0.8") {
    this.catalogIds = catalogIds ?? [];
    this.acceptInlineCatalogs = acceptInlineCatalogs;
    this.version = version;
    this.uri = version === "v0.9" ? A2UI_V09_EXTENSION_URI : A2UI_EXTENSION_URI;
  }

  get params(): A2UIRecord {
    return {
      ...(this.catalogIds.length ? { supportedCatalogIds: [...this.catalogIds] } : {}),
      acceptsInlineCatalogs: this.acceptInlineCatalogs,
    };
  }

  isActive(context: {
    activeExtensions?: readonly string[];
    active_extensions?: readonly string[];
    clientExtensions?: readonly string[] | Set<string>;
    client_extensions?: readonly string[] | Set<string>;
  } = {}): boolean {
    const active = context.clientExtensions
      ?? context.client_extensions
      ?? context.activeExtensions
      ?? context.active_extensions
      ?? [];
    return active instanceof Set ? active.has(this.uri) : active.includes(this.uri);
  }

  is_active(context: Parameters<typeof this.isActive>[0] = {}): boolean {
    return this.isActive(context);
  }

  onRequest(context: Parameters<typeof this.isActive>[0] & { state?: A2UIRecord; getExtensionMetadata?: (uri: string, key: string) => unknown; get_extension_metadata?: (uri: string, key: string) => unknown }): Promise<void> {
    if (!this.isActive(context)) {
      return Promise.resolve();
    }
    context.state ??= {};
    const metadata = context.getExtensionMetadata?.(this.uri, "catalogId") ?? context.get_extension_metadata?.(this.uri, "catalogId");
    context.state.a2ui_catalog_id = typeof metadata === "string" ? metadata : this.catalogIds[0] ?? null;
    context.state.a2ui_active = true;
    return Promise.resolve();
  }

  on_request(context: Parameters<typeof this.onRequest>[0]): Promise<void> {
    return this.onRequest(context);
  }

  onResponse(context: { state?: A2UIRecord }, result: unknown): Promise<unknown> {
    if (!context.state?.a2ui_active || typeof result !== "string") {
      return Promise.resolve(result);
    }
    const messages = this.version === "v0.9" ? extractA2UIV09JsonObjects(result) : extractA2UIJsonObjects(result);
    const parts = messages.map((message) => this.version === "v0.9" ? buildDataPartV09(message) : buildDataPart(message)).filter((part): part is A2UIRecord => part !== null);
    return Promise.resolve(parts.length ? new A2UIResponse({ text: result, a2ui_parts: parts, a2uiParts: parts }) : result);
  }

  on_response(context: { state?: A2UIRecord }, result: unknown): Promise<unknown> {
    return this.onResponse(context, result);
  }
}

function defineSnakeAliases(target: object, source: A2UIRecord): void {
  for (const [key, value] of Object.entries(source)) {
    const snake = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    if (snake !== key && !(snake in target)) {
      Object.defineProperty(target, snake, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      });
    }
  }
}

function assertExactlyOne(options: A2UIRecord, keys: readonly string[], label: string): void {
  if (Object.keys(options).length === 0) {
    return;
  }
  const count = keys.reduce((sum, key) => sum + (options[key] === undefined || options[key] === null ? 0 : 1), 0);
  if (count !== 1) {
    throw new Error(`Exactly one ${label} must be set, got ${String(count)}.`);
  }
}

function toValidationError(error: unknown, prefix: string): A2UIValidationError {
  return error instanceof A2UIValidationError
    ? error
    : new A2UIValidationError(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);
}

function isRecord(value: unknown): value is A2UIRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSurfaceId(data: A2UIRecord): string | null {
  for (const key of ["beginRendering", "surfaceUpdate", "dataModelUpdate", "deleteSurface", "createSurface", "updateComponents", "updateDataModel"]) {
    const value = data[key];
    if (isRecord(value) && typeof value.surfaceId === "string") {
      return value.surfaceId;
    }
  }
  return null;
}

function filterComponents(message: A2UIRecord, allowed: ReadonlySet<string>): A2UIRecord {
  const update = message.surfaceUpdate;
  if (!isRecord(update) || !Array.isArray(update.components)) {
    return message;
  }
  return {
    ...message,
    surfaceUpdate: {
      ...update,
      components: update.components.filter((entry) => {
        const component = isRecord(entry) ? entry.component : null;
        return isRecord(component) && Object.keys(component).every((name) => allowed.has(name));
      }),
    },
  };
}

function filterComponentsV09(message: A2UIRecord, allowed: ReadonlySet<string>): A2UIRecord {
  const update = message.updateComponents;
  if (!isRecord(update) || !Array.isArray(update.components)) {
    return message;
  }
  return {
    ...message,
    updateComponents: {
      ...update,
      components: update.components.filter((entry) => !isRecord(entry) || typeof entry.component !== "string" || allowed.has(entry.component)),
    },
  };
}

function missingRequiredCatalogFields(componentName: string, props: unknown): string[] {
  if (!isRecord(props)) {
    return (STANDARD_CATALOG_REQUIRED_FIELDS[componentName] ?? []).map((fields) => fields[0] ?? "");
  }
  const fieldGroups = STANDARD_CATALOG_REQUIRED_FIELDS[componentName] ?? [];
  const missing: string[] = [];
  for (const fields of fieldGroups) {
    if (!fields.some((field) => field in props && props[field] !== undefined && props[field] !== null)) {
      missing.push(fields[0] ?? "");
    }
  }
  return missing;
}

function buildDataPart(message: A2UIRecord): A2UIRecord | null {
  try {
    return { kind: "data", data: validateA2UIMessage(message).modelDump(), metadata: { mimeType: A2UI_MIME_TYPE } };
  } catch {
    return null;
  }
}

function buildDataPartV09(message: A2UIRecord): A2UIRecord | null {
  try {
    return { kind: "data", data: validateA2UIMessageV09(message).modelDump(), metadata: { mimeType: A2UI_MIME_TYPE } };
  } catch {
    return null;
  }
}

function extractJsonObjectsWithKeys(text: string, keys: readonly string[]): A2UIRecord[] {
  const results: A2UIRecord[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") {
      continue;
    }
    const parsed = rawDecodeObject(text, index);
    if (!parsed) {
      continue;
    }
    if (keys.some((key) => key in parsed.value)) {
      results.push(parsed.value);
    }
    index = parsed.end - 1;
  }
  return results;
}

function rawDecodeObject(text: string, start: number): { value: A2UIRecord; end: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const value: unknown = JSON.parse(text.slice(start, index + 1));
          return value && typeof value === "object" && !Array.isArray(value)
            ? { value: value as A2UIRecord, end: index + 1 }
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
