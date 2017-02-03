function onFormSubmit(e) {
  try{
    var docList = JSON.parse(PropertiesService.getDocumentProperties().getProperty("DOCS"));
    var response = e.response;
    var values = createResponseObject(response);
    for (var i in docList){
      processDoc(i, docList[i], values)
    }
  }catch(e){
    MailApp.sendEmail("cameron.alizadeh@performance.ca", "Populate Docs Error",
      "User: " + Session.getActiveUser()
      + "\r\nMessage: " + e.message
      + "\r\nFile: " + e.fileName
      + "\r\nLine: " + e.lineNumber);
    MailApp.sendEmail(Session.getActiveUser(), "Populate Docs Error", "Populate Docs recently failed to succeed. Contact cameron.alizadeh@performance.ca for more information.");
  }
}

function processDoc(id, props, values){
  var newFile = DriveApp.getFileById(id).makeCopy(processFilename(props, values));
  var newDoc = DocumentApp.openById(newFile.getId());
  var dateValues = {};
  replaceValues(newDoc, values, props);
  newDoc.saveAndClose();
  var activeUser = Session.getActiveUser().getEmail();
  var submitter = values["user-email"];
  var submitterAsOwner = (props["SET_SUBMITTER_AS_OWNER"] && submitter);
  var recipients = JSON.parse(JSON.stringify(props["RECIPIENTS"]));
  
  if (!submitterAsOwner || submitter == activeUser){
    if (recipients.indexOf(activeUser) == -1){
      recipients.push(activeUser);
    }
  }
  else{
    newFile.setOwner(submitter);
    if (recipients.indexOf(submitter) >= 0){
      recipients.splice(recipients.indexOf(submitter), 1);
    }
    //if (submitter != activeUser && recipients.indexOf(activeUser) == -1){
    //  newFile.removeEditor(activeUser);
    //} commented due to script error: "We're sorry, a server error occurred. Please wait a bit and try again" at this line.
  }
  if (recipients.length > 0){
    newFile.addEditors(recipients);
  }
}

function processFilename(props, values){
  var filename = props["FILENAME"];
  var start = filename.search(/<<.+?>>/);
  if (start > -1){
    var middle = filename.search(/></) + 1;
    var end = filename.search(/>>/) + 2;
    if (middle > 0 && middle < end && middle > start){
      var date = values[filename.substring(start + 2, middle - 1)];
      var format = filename.substring(middle + 1, end - 2);
    }
    else{
      var date = values[filename.substring(start + 2, end - 2)];
      var format = props["DATE_FORMAT"];
    }
    if (Object.prototype.toString.call(date) == "[object Date]"){
      return filename.replace(/<<.+?>>/, Utilities.formatDate(date, Session.getScriptTimeZone(), format));
    }
  }
  return filename;
}

function createResponseObject(response){
  var itemResponses = response.getItemResponses();
  var values = {};
  var itemType;
  var singleValue;
  for (var i in itemResponses){
    itemType = itemResponses[i].getItem().getType();
    if (itemType == FormApp.ItemType.CHECKBOX || itemType == FormApp.ItemType.GRID || itemType == FormApp.ItemType.IMAGE || itemType == FormApp.ItemType.PAGE_BREAK || itemType == FormApp.ItemType.SECTION_HEADER){
    }
    else if (itemType == FormApp.ItemType.DATE){
      singleValue = itemResponses[i].getResponse().split("-");
      if (singleValue.length == 2){
        values[itemResponses[i].getItem().getTitle()] = new Date(new Date().getFullYear(), singleValue[0] - 1, singleValue[1]);
      }
      else{
        values[itemResponses[i].getItem().getTitle()] = new Date(singleValue[0], singleValue[1] - 1, singleValue[2]);
      }
    }
    else if(itemType == FormApp.ItemType.DATETIME){
      singleValue = itemResponses[i].getResponse().split(" ");
      var date = singleValue[0].split("-");
      var time = singleValue[1].split(":");
      values[itemResponses[i].getItem().getTitle()] = new Date(date[0], date[1] - 1, date[2], time[0], time[1]);
    }
    else{
      values[itemResponses[i].getItem().getTitle()] = itemResponses[i].getResponse();
    }
  }
  values["current-date"] = new Date();
  try{
    values["user-email"] = response.getRespondentEmail();
  }
  catch (err){}
  return values;
}

function replaceValues(doc, values, props){
  var body = doc.getBody().editAsText();
  var value;
  for (var key in values){
    value = values[key];
    if (Object.prototype.toString.call(value) == "[object Date]"){
      value = Utilities.formatDate(value, Session.getScriptTimeZone(), props["DATE_FORMAT"]);
    }
    body.replaceText("\\<\\<" + string2regex(key) + "\\>\\>", value);
  }
  replaceSpecials(body, values);
}

function replaceSpecials(body, values){
  var element;
  var text;
  var startOffset;
  var endOffsetInclusive;
  var middle;
  var finalValue;
  var rangeElement = body.findText("<<[^>]+><[^>]+>>");
  while (rangeElement){
    element = rangeElement.getElement();
    text = element.asText().getText();
    if (rangeElement.isPartial()){
      startOffset = rangeElement.getStartOffset();
      endOffsetInclusive = rangeElement.getEndOffsetInclusive();
    }
    else{
      startOffset = 0;
      endOffsetInclusive = text.length - 1;
    }
    middle = startOffset + text.substring(startOffset, endOffsetInclusive).indexOf("><") + 1;
    try{
      finalValue = Utilities.formatDate(values[text.substring(startOffset + 2, middle - 1)], Session.getScriptTimeZone(), text.substring(middle + 1, endOffsetInclusive - 1));
      element.asText().insertText(startOffset, finalValue).deleteText(startOffset + finalValue.length, endOffsetInclusive + finalValue.length);
    }
    catch (e){
      MailApp.sendEmail("cameron.alizadeh@performance.ca", "Populate Docs Error",
      "User: " + Session.getActiveUser()
      + "\r\nMessage: " + e.message
      + "\r\nFile: " + e.fileName
      + "\r\nLine: " + e.lineNumber);
    }
    rangeElement = body.findText("<<[^>]+><[^>]+>>");
  }
  var rangeElement = body.findText("<<[^>]+> [+*/-] <[^>]+>>");
  while (rangeElement){
    element = rangeElement.getElement();
    text = element.asText().getText();
    if (rangeElement.isPartial()){
      startOffset = rangeElement.getStartOffset();
      endOffsetInclusive = rangeElement.getEndOffsetInclusive();
    }
    else{
      startOffset = 0;
      endOffsetInclusive = text.length - 1;
    }
    middle = startOffset + text.substring(startOffset, endOffsetInclusive).indexOf("> ") + 1;
    try{
      finalValue = "NaN";
      if (text.substring(middle + 1, middle + 2) == "+"){
        finalValue = Number(values[text.substring(startOffset + 2, middle - 1)]) + Number(values[text.substring(middle + 4, endOffsetInclusive - 1)]);
      }
      else if (text.substring(middle + 1, middle + 2) == "-"){
        finalValue = Number(values[text.substring(startOffset + 2, middle - 1)]) - Number(values[text.substring(middle + 4, endOffsetInclusive - 1)]);
      }
      else if (text.substring(middle + 1, middle + 2) == "*"){
        finalValue = Number(values[text.substring(startOffset + 2, middle - 1)]) * Number(values[text.substring(middle + 4, endOffsetInclusive - 1)]);
      }
      else if (text.substring(middle + 1, middle + 2) == "/"){
        finalValue = Number(values[text.substring(startOffset + 2, middle - 1)]) / Number(values[text.substring(middle + 4, endOffsetInclusive - 1)]);
      }
      finalValue = String(finalValue);
      element.asText().insertText(startOffset, finalValue).deleteText(startOffset + finalValue.length, endOffsetInclusive + finalValue.length);
    }
    catch (e){
      MailApp.sendEmail("cameron.alizadeh@performance.ca", "Populate Docs Error",
      "User: " + Session.getActiveUser()
      + "\r\nMessage: " + e.message
      + "\r\nFile: " + e.fileName
      + "\r\nLine: " + e.lineNumber);
      element.asText().deleteText(startOffset, endOffsetInclusive);
    }
    rangeElement = body.findText("<<[^>]+> [+*/-] <[^>]+>>");
  }
}

function string2regex(string){
  var special = ["\\", "[", "^", "$", ".", "|", "?", "*", "+", "(", ")"]; //is this an exhaustive list?
  var regex;
  for (var i in special){
    regex = new RegExp("\\" + special[i], "g");
    string = string.replace(regex, "\\" + special[i]);
  }
  return string;
}