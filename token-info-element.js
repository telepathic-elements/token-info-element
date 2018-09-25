import {TelepathicElement} from "https://telepathic-elements.github.io/telepathic-element/telepathic-element.js";
import {Web3ServiceLoader} from "https://telepathic-elements.github.io/web3-service-loader/web3-service-loader.js";
export default class TokenInfoElement extends TelepathicElement{
	static describe(){return `An element to provide network stats and info for Ethereum Tokens.`};
	constructor(fileName,noshadow,delayRender){
		super(fileName,noshadow,delayRender);
        this.userNetwork ="MAINNET";
        this.currentBlock = 0;
        this.gasPriceGwei = 50;
        this.qtyBuy = 10000;
        this.user = {
            account : "unset",
            balances : {
                eth : 0.000,
                contract : 0.000,
            }
        }
        this.config ={ "mainnet" : {"provider" : "wss://mainnet.infura.io/ws"}};
        this.marqueeMessage = "Loading Please Wait...";
        this.contract = {
            address: "0x000000000000000000",
        }
        this.ethereum = window.ethereum;
    }
    static get observedAttributes() {
        return ['token',"network","contract"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        //token address and or network, reconnect to infura
        console.log(attrName+" changed, was "+oldVal+" now is "+newVal);
        if(attrName =="contract" || attrName == "token"){
            this.contract.address = newVal;
        }else{
            this[attrName] = newVal;
        }
        this.reset();
    }

    async init(){
        console.warn(`${this.constructor.name} entering init!`);
    }

    async onNewBlock(err,headers){
        if(err){
            console.error(err);
            return;
        }
        console.log("new block: ",headers);
        this.currentBlock = headers.number;
        let gasPrice = await this.web3.eth.getGasPrice();
        this.gasPriceGwei = this.web3.utils.fromWei(gasPrice,'gwei');
        this.updateBalances();
    }
    async updateBalances(){
        if(this.user.account && this.user.account !== "unset" && this.user.account !== "undefined"){
            let balEth = await this.web3.eth.getBalance(this.user.account);
            this.user.balances.eth = this.web3.utils.fromWei(balEth);
            let balContract = await this.myContract.methods.balanceOf(this.user.account).call();
            this.user.balances.contract = this.contractToDisplay(balContract);
        }else{
            console.warn("user account is unset");
            try{
                this.walletBtn.classList.remove("hide");
                this.walletBtn.classList.add("show");
            }catch(err){
                console.warn(err);
            }
        }
    }
    async onReady(){
        console.warn(`${this.constructor.name} entering onReady!`);
        
        this.reset();
    }

    async reset(){
        console.warn(`${this.constructor.name} entering reset!`);
        this.marquee = this.$.querySelector("#loading-area");
        if(!this.marquee){
            console.warn(`${this.constructor.name} can't be reset until UI is rendered`);
            return;
        }
        this.marqueeMessage = "Loading please wait...";
        this.marquee.removeAttribute("hidden");

        let node = this.$.querySelector('#loading-area');
        console.log("marquee: ",node);
        node.setAttribute("style","display: block;");
        //Do init work here
        this.contract.address = this.getAttribute("contract");
        if(!this.contract.address){
            //LOTSO is default
            this.contract.address = "0x1f549273142dd53d38a9585d0c456ee502bd16c8";
        }
        this.abiFile = this.getAttribute("abiFile");
        if(!this.abiFile){
            //LOTSO is default
            this.abiFile = "https://telepathic-elements.github.io/demos/json/lotso.abi.json";
        }
        //this.config = await this.loadFileJSON("./json/config.json");
        //this.contract.name = this.config.contract.name;
        //this.contract.address = this.config.contract.address;
        //this.contract.symbol = this.config.contract.symbol;
        //this.contract.totalSupply = this.config.contract.totalSupply;
        console.warn("this.contract: ",this.contract);
        try{
        this.web3 = await Web3ServiceLoader.getInstance(this.config["mainnet"].provider);
        this.web3.eth.subscribe('newBlockHeaders',(err,data)=>{this.onNewBlock(err,data);});
        }catch(err){
            console.warn(err);
            setTimeout(()=>{
                this.reset();
            },10000);
            return;
        }
        this.contractABI = await this.loadFileJSON(this.abiFile);
        for(let method of this.contractABI){
            if(method.name){
                console.log("method: ",method.name);
                if(method.name.toLowerCase().includes("get") && method.name.toLowerCase().includes("price")){
                    this.priceFunc = method.name;
                    console.log("Probable pricing function found: ",method);
                    break;
                }
            }
        }
        this.myContract = await new this.web3.eth.Contract(this.contractABI,this.contract.address);
        console.log("this.myContract: ",this.myContract);
        this.contract.name = await this.myContract.methods.name().call();
        this.contract.decimals = await this.myContract.methods.decimals().call();
        this.contract.symbol = await this.myContract.methods.symbol().call();
        let supply = await this.myContract.methods.totalSupply().call();
        this.contract.totalSupply = this.contractToDisplay(supply);
        let tknPrice =  await this.myContract.methods[this.priceFunc]().call();
        this.contract.price = await this.web3.utils.fromWei(tknPrice,'ether');
        this.calculate();

        this.walletBtn = this.$.querySelector("#walletBtn");
        this.accountArea = this.$.querySelector("#accountDetails");

        if((window.Web3 && window.Web3.givenProvider) || this.ethereum){
            if(window.Web3.givenProvider){
                console.log("Given Provider is ",window.Web3.givenProvider);
                console.log("window.ethereum is ",window.ethereum);
                this.wallet = new window.Web3(window.web3.currentProvider);
            }else{
                console.log("No provider given yet");
            }
            this.walletBtn.onclick = (evt)=>{this.connectWallet()}
            this.walletBtn.removeAttribute("hidden");
        }
        node = this.$.querySelector('#loading-area');
        console.log("marquee: ",node);
        node.setAttribute("style","display: none;");
        node = this.$.querySelector('#copyBtn');
        if(node){
            node.onclick = this.copyToClipBoard;
        }else{
            console.error("copy button is missing on ",this.$);
        }
    }

    async copyToClipBoard(evt){
        console.log("copyToClipBoard: ",evt);
        let clipboard;
        if(!clipboard){
            clipboard = navigator.clipboard || window.clipboard;
        }
    
        let perm = { state: "granted"};
        try{
            perm = await navigator.permissions.query({name: "clipboard-write"})
        }catch(err){
            console.warn(err);
        }   

        if (perm.state == "granted" || perm.state == "prompt") {
            try{
                console.log("this: ",this);
                let parent = this.parentNode;
                console.log("parent: ",parent.innerText);
                let text = parent.innerText;
                console.log("clipboard: ",clipboard);
                let result = await clipboard.writeText(text);
                console.log("result: ",result);
                alert(`Successfully copied ${text} to clipboard`);
            }catch(err){
                console.warn(err);
            }
        }
        
    }
    async connectWallet(){
        if(window.ethereum){
            //eip-1193
            console.log("detected eip-1193");
            this.user.account = (await this.ethereum.enable())[0];
            console.log("this.ethereum: ",this.ethereum);
            console.log("account: ",this.user.account);
            if(this.ethereum.on){
                this.ethereum.on('accountsChanged', (evt)=>{
                    console.log("Accounts Changed, reconnecting wallet!");
                    this.connectWallet();
                });
            }else{
                //(Probably metamask issue, still not eip-1193 compliant), oh well!
            }
        }else{
            //Not eip-1193
            console.log("no eip-1193");
            console.log("wallet: ",this.wallet);

            let accounts = await this.wallet.eth.getAccounts();
            console.log("accounts: ",accounts);
            if(accounts && accounts.length >= 1){
                this.user.account = accounts[0];
            }else{
                alert("failed to connect to wallet, please make sure you are logged into MetaMask and then refresh the page");
                this.reset();
                return;
            }
        }
        this.walletBtn.classList.remove("button-primary");
        this.walletBtn.classList.add("hide");
        this.accountArea.removeAttribute("hidden");
        this.$.querySelector("#buyNow").onclick = (evt)=>{this.buyNow(evt);};
        this.$.querySelector('#buySlider').onchange = (evt)=>{this.calculate(evt);};
        this.$.querySelector('#buyFld').onchange = this.$.querySelector('#buySlider').onchange;
        this.updateBalances();
    }

    calculate(evt){
        let units = this.qtyBuy;
        let price = this.contract.price;
        this.totalETH = units * price;
    }

    async buyNow(evt){
        //alert(`About to buy ${this.qtyBuy} of ${this.contract.symbol}`);
        let wei = this.web3.utils.toWei(""+this.totalETH,'ether');
        let params = {
            from : this.user.account,
            value: ""+wei,
            to: this.contract.address
        }
        console.log("params: ",params);
        console.log("ethereum: ",this.ethereum);
        let web3;
        if(this.ethereum){
            web3 = new Web3(this.ethereum);
        }else{
            web3 = this.wallet;
        }
        try{
            let tx = await web3.eth.sendTransaction(params);
            console.log("tx: ",tx);
            alert("Thank you for your purchase!");
            this.reset();
        }catch(err){
            console.error(err);
            alert("There was an error sending the transaction, please try later");
        }
    }
    contractToDisplay(val){
        //console.log(val);
        let num = parseInt(val);
       
        if(num != 0 && this.contract.decimals){
            //console.log(`${num} ** ${0-this.contract.decimals}`);
            num *= (10 ** (-this.contract.decimals));
        }
        //console.log(num);
        return Number(num).toFixed(this.contract.decimals);
    }

    displayToContract(val){
        let num = val;
        if(num != 0 && this.contract.decimals){
            num *= (10 ** this.contract.decimals);
        }
        return Math.ceil(num);
    }
}