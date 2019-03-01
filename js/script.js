let expression;
let cy;

// Shows Serializable/Non-Serializable
let conflictMessageObject = {
    true : {
        alert: "alert alert-success",
        message: "The transaction is not conflict serializable."
    },

    false: {
        alert: "alert alert-danger",
        message: "The transaction is conflict serializable."
    }
}

// Helper groupby function [ {variable: x, transaction: T1}, {variable: x, transaction: T2}, {variable: y, transaction T1} ] -> x -> [T1, T2], y -> [T1]
Array.prototype.groupBy = function(prop) {
    return this.reduce(function(groups, item) {
      const val = item[prop]
      groups[val] = groups[val] || []
      groups[val].push(item)
      return groups
    }, {})
  }

// Default expression for button click
const DEFAULT_EXPRESSION = "r1(x) r1(y) w2(x) w1(x) r2(y)"

// This event is triggered whenever something is written on input
$("#expressionInput").keyup((e)=>{
    expression = e.target.value;
    expressionParser(expression)
});

// Shows a default graph on click
$("#defaultExpressionButton").on('click', ()=>{
    expression = DEFAULT_EXPRESSION;
    $("#expressionInput").val(DEFAULT_EXPRESSION);
    expressionParser(expression);
})

// Clears Transaction and Variable list shown on web
function clearAll(){
    $("#transactions").empty()
    $("#variables").empty()
}

// This function actually does all the things
function expressionParser(text){
    // Check if text exists or not
    if (text !== undefined){
    
    // Remove trailing spaces 
    text = text.trim();
    
    // Clears previously added transactions and variables shown on the html
    clearAll(); 
    
    // r1(x) r2(z) -> [T1, T2]
    let allTransactions = text.replace(new RegExp('w|r', 'g'), 'T').replace(/\(.\w*\)/gi, '').split(' ');
    // r1(x) r2(z) -> [x, z]
    let allVariables = text.match(/\(.\w*\)/gi).map(v => v.replace('(', '').replace(')', ''));
    // Remove consecutive transactions -> [T1, T1, T2, T3] -> [T1, T2, T3]
    let transactions = allTransactions.reduce( (acc, value) => {
        if (acc.length === 0){
            acc.push(value)
        } else if ( acc[acc.length - 1] !== value ){
            acc.push(value)
        }
        return acc;

    }, []);

    // Get only unique variables from multiple occurances
    let variables = Array.from(new Set(allVariables))

    // variable transaction group, T1 -> [x, x, y , z]
    let _variableTransactionGroup = _.zip(allVariables, allTransactions).map(x => {return {variable: x[0], transaction: x[1]}}).groupBy('transaction')
    // variable tansaction map, x -> [T1, T1, T2, T3]
    let _variableToTransactionMap = _.zip(allVariables, allTransactions).map(x => {return {variable: x[0], transaction: x[1]}}).groupBy('variable')

    let variableTransactionGroup = {}
    let variableToTransactionMap = {}

    // Convert to plain array from complex object -> T1 -> [x, x, y , z]
    Object.keys(_variableTransactionGroup).map((k, i) => {
        variableTransactionGroup[k] = Array.from(new Set(_variableTransactionGroup[k].map(x => x.variable)))
    })

    // Convert to plain array from complex object -> x -> [T1, T1, T2, T3]
    Object.keys(_variableToTransactionMap).map((k, i) => {
        variableToTransactionMap[k] = _variableToTransactionMap[k].map(x => x.transaction).reduce((acc, value) => {

            if (acc.length === 0){
                acc.push(value)
            } else if ( acc[acc.length - 1] !== value ){
                acc.push(value)
            }
            return acc;

        }, []);
    })

    // Show transcations to html
    _.each(transactions, (T)=>{
        $("#transactions").append(
            `<span class="badge badge-primary">${T}</span>`
        )
    })

    // Same goes for variables
    _.each(variables, (V)=>{
        $("#variables").append(
            `<span class="badge badge-secondary">${V}</span>`
        )
    })


    let nodes = [];
    let _edges = [];

    // Adding nodes for cytoscape node format
    _.each(Array.from(new Set(transactions)), (T) => {
        nodes.push({data: { id: T, name: T }})
    })

    // Creating edges 
    Object.keys(variableToTransactionMap).map(k => {
        let trx = variableToTransactionMap[k];
        for (let i = 0; i < trx.length - 1; i++){
            _edges.push({source: trx[i], target: trx[i + 1]})
        }
    })

    // Remove multiple edge occurance to single -> [{source: T1, target: T2}, {source: T1, target: T2}, {source: T1, target: T2}] -> {source: T1, target: T2}
    let edges = _edges.filter(function (a) {
        var key = a.source + '|' + a.target;
        if (!this[key]) {
            this[key] = true;
            return true;
        }
    }, Object.create(null));

    // For graphlib
    let G = new graphlib.Graph();
    // Add nodes for graphlib Graph
    Array.from(new Set(allTransactions)).map(T => {
        G.setNode(T)
    })

    // Convert edge format for cytoscape library
    let reducedEdges = edges.map(function(d){
        // This one is for graphlib
        G.setEdge(d.source, d.target);
        return {
            data: {
                source: d.source,
                target: d.target
            }
        }

    }); 

    // This creates the graph
    cy = cytoscape({

        container: document.getElementById('viz'), // container to render in
      
        elements: {
            nodes: nodes,
            edges: reducedEdges
        },

        style: [
            {
                selector: 'node',
                style: {
                    'content' : 'data(name)'
                }
            },
            {
                selector: 'edge',
                style: {
                  'curve-style': 'bezier',
                  'target-arrow-shape': 'triangle'
                }
            },
        ]
    })

    // Whether the graph is serializable or not serializable
    let verdict = !graphlib.alg.isAcyclic(G); 

    // Show the result on html
    $("#verdict").attr('class', conflictMessageObject[verdict].alert).text(conflictMessageObject[verdict].message)
    }
}