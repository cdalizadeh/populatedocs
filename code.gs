function onInstall(){
  onOpen();
}

function onOpen(){
  FormApp.getUi().createAddonMenu().addItem("Add Docs", "addDocs").addItem("Settings", "settings").addToUi();
}

function addDocs(){
  var ui = HtmlService.createTemplateFromFile("Add Docs")
  .evaluate()
  .setWidth(630)
  .setHeight(150);
  FormApp.getUi().showModalDialog(ui, "Add Docs");
}

function settings(){
  var ui = HtmlService.createTemplateFromFile("Settings")
  .evaluate()
  .setWidth(1069)
  .setHeight(settingsHeight());
  FormApp.getUi().showModalDialog(ui, "Settings");
}

function settingsHeight(){
  try{
    var docList = JSON.parse(PropertiesService.getDocumentProperties().getProperty("DOCS"));
    var numDocs = Object.keys(docList).length;
  }
  catch (err){
    var numDocs = 0;
  }
  return Math.min(700, 147 + numDocs * 91.5);
}

function addDoc(url){
  var doc = DocumentApp.openByUrl(url);
  var id = doc.getId();
  var properties = PropertiesService.getDocumentProperties();
  triggerCheck(properties);
  var docList = JSON.parse(properties.getProperty("DOCS"));
  if (docList == null){
    docList = {};
  }
  if (id in docList){
    return false;
  }
  docList[id] = {"NAME" : doc.getName(), "FILENAME" : "<<current-date>> " + doc.getName(), "DATE_FORMAT" : "yyyy-MM-dd", "RECIPIENTS" : [Session.getEffectiveUser().getEmail()], "SET_SUBMITTER_AS_OWNER" : true, "KEEP_COPY_IN_DRIVE" : true};
  properties.setProperty("DOCS", JSON.stringify(docList));
  return true;
}

function triggerCheck(properties){
  if (ScriptApp.getUserTriggers(FormApp.getActiveForm()).length == 0){
    triggerId = ScriptApp.newTrigger("onFormSubmit").forForm(FormApp.getActiveForm()).onFormSubmit().create().getUniqueId();
    properties.setProperty("TRIGGER_ID", triggerId);
    setEmailCollectionTrue();
  }
}

function removeDoc(id){
  var properties = PropertiesService.getDocumentProperties();
  var docList = JSON.parse(properties.getProperty("DOCS"));
  delete docList[id];
  properties.setProperty("DOCS", JSON.stringify(docList));
  return true;
}

function getDocList(){
  var properties = PropertiesService.getDocumentProperties();
  var docList = JSON.parse(properties.getProperty("DOCS"));
  if (docList){
    return docList;
  }
  return {};
}

function updateDocList(docList){
  PropertiesService.getDocumentProperties().setProperty("DOCS", JSON.stringify(docList));
  for (var i in docList){
    if (docList[i]["SET_SUBMITTER_AS_OWNER"]){
      setEmailCollectionTrue();
      break;
    }
  }
}

function setEmailCollectionTrue(){
  try{
    FormApp.getActiveForm().setCollectEmail(true);
  }
  catch (err){}
}