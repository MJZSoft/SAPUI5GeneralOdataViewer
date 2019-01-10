/*global location */
sap.ui.define([
	"com/mjzsoft/sapui5/demo/GeneralODataViewer/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/mjzsoft/sapui5/demo/GeneralODataViewer/model/formatter"
], function (BaseController, JSONModel, formatter) {
	"use strict";

	return BaseController.extend("com.mjzsoft.sapui5.demo.GeneralODataViewer.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading"),
				__metadata: {
					uri: "URI",
					type: "Type"
				}
			});

			this.setModel(oViewModel, "detailView");

			var oData = {
				DataSet: []
			};
			//Creation of the JSON Model for the Test Daya
			var oDataModel = new sap.ui.model.json.JSONModel(oData);
			this.setModel(oDataModel, "DataModel");

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onSendEmailPress: function () {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function () {
			var oViewModel = this.getModel("detailView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});

			oShareDialog.open();
		},

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function (oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var sSetName = oEvent.getParameter("arguments").SetName,
				sEntityName = oEvent.getParameter("arguments").EntityName;
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			var oModel = this.getModel();
			oModel.metadataLoaded().then(function () {
				oModel = this.getModel();
				oModel.setUseBatch(false);
				oModel.read("/" + sSetName, {
					success: function (oData, oResponse) {
						var oItems = {
							DataSet: oData.results
						};
						this.getModel("DataModel").setData(oItems);
						this.createSmartTable(sEntityName, sSetName);
					}.bind(this)
				});
			}.bind(this));
		},
		createSmartTable: function (sEntityName, sSetName) {
			var oEntity = this._extractEntity(sEntityName);
			if (oEntity) {
				var aCells = [];
				for (var i = 0; i < oEntity.property.length; i++) {
					var oCol = oEntity.property[i];
					aCells.push(oCol.name);
				}
				if (aCells.length > 0) {
					var sCols = "",
						sCels = "";
					for (i = 0; i < aCells.length; i++) {
						sCols += "" +
							"	        <m:Column visible='true'> \n" +
							"		       <m:customData> \n" +
							"			      <core:CustomData key='p13nData' \n" +
							"				     value='\\{\"sortProperty\":\"" + aCells[i] + "\",\"filterProperty\":\"" + aCells[i] + "\",\"columnKey\":\"" +
							aCells[i] + "\",\"leadingProperty\":\"" + aCells[i] + "\",\"columnIndex\":\"" + i + "\"}'/> \n" +
							"		       </m:customData> \n" +
							"		       <m:Text text='" + aCells[i] + "'/> \n" +
							"	        </m:Column> \n";
						sCels += "" +
							"			   <m:Text text=\"{path:'DataModel>" + aCells[i] + "'}\"/> \n";
					}
					var oViewModel = this.getModel("detailView");
					oViewModel.setProperty("/setItems", sSetName);
					
					var oModelX = new sap.ui.model.xml.XMLModel();
					oModelX.attachRequestCompleted(function () {
						var xmlStr = oModelX.getXML();
						xmlStr = xmlStr.replace("<!--cols-->", sCols).replace("<!--cels-->", sCels);
						//
						var oLayout = this.getView().byId("myLayout");
						var aControls = oLayout.removeAllContent();
						for (var j = 0; j < aControls.length; j++) {
							var oControl = aControls[j];
							if (typeof oControl.destroy === "function") {
								oControl.destroy();
							}
						}
						sap.ui.core.Fragment.load({
							type: "XML",
							id: sSetName,
							definition: xmlStr,
							controller: this
						}).then(function (oControll) {
							oLayout.addContent(oControll);
						});
					}.bind(this));
					oModelX.loadData("../view/SmartTable.fragment.xml");
				}
			}
		},
		createTable: function (sEntityName) {
			var oTable = this.byId("tableDataSet"),
				oEntity = this._extractEntity(sEntityName);
			if (oEntity) {
				oTable.removeAllColumns();
				oTable.unbindItems();
				var aCells = [];
				for (var i = 0; i < oEntity.property.length; i++) {
					var oCol = oEntity.property[i];
					var oColumn = new sap.m.Column({
						header: new sap.m.Label({
							text: oCol.name
						})
					});
					oColumn.addCustomData(
						new sap.ui.core.CustomData({
							key: "p13nData",
							value: "{'sortProperty': '" + oCol.name + "', 'filterProperty': '" + oCol.name + "', 'columnKey': '" + oCol.name +
								"', 'leadingProperty': '" + oCol.name + "', 'columnIndex':'" + i + "'}"
						}));
					aCells.push(new sap.m.Text({
						text: "{DataModel>" + oCol.name + "}"
					}));
					oTable.addColumn(oColumn);
				}

				oTable.bindItems({
					path: "DataModel>/DataSet",
					template: new sap.m.ColumnListItem({
						cells: aCells
					})
				});
			}
		},
		/*
		 * Extracts the related entity object from the metadata 
		 */
		_extractEntity: function (sEntityName) {
			var aRes = sEntityName.split("."),
				sNamespace = aRes[0],
				sEntity = aRes[1],
				oEntity,
				oModel = this.getModel(),
				oMetaData = oModel.getServiceMetadata();
			for (var j = 0; j < oMetaData.dataServices.schema.length; j++) {
				if (oMetaData.dataServices.schema[j].namespace === sNamespace) {
					var aEntities = oMetaData.dataServices.schema[j].entityType;
					for (var i = 0; i < aEntities.length; i++) {
						if (aEntities[i].name === sEntity) {
							oEntity = aEntities[i];
							break;
						}
					}
					break;
				}
			}
			return oEntity;
		},
		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel().getObject(sPath),
				sObjectId = oObject.CategoryID,
				sObjectName = oObject.CategoryName,
				oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView"),
				oLineItemTable = this.byId("lineItemsList"),
				iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		}
	});

});